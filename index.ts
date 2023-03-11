import chalk from "chalk"
import { spawn } from "child_process"
import { existsSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { Project, basePath, mainTemplate, projects, subTemplate } from "./config.js"

const nginx = (project: Project) =>
    subTemplate.replaceAll("${name}", project.name).replaceAll("${port}", `${project.port}`)

const cmd = (command: string, cwd: string | undefined, ignoreErr = false, log = true): Promise<void> =>
    new Promise((resolve) => {
        const ex = spawn(command, { cwd })

        ex.on("exit", (code) => {
            if (!ignoreErr && code !== 0) {
                console.log(chalk.red(`Error running "${command}" in "${cwd}": exited with code ${code}`))
                process.exit(1)
            }

            resolve()
        })

        if (log) {
            ex.stdout.on("data", (data) => {
                console.log(chalk.gray(data.toString()))
            })

            ex.stderr.on("data", (data) => {
                console.log(chalk.red("[Error] ") + chalk.gray(data.toString()))
            })
        }
    })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const start = performance.now()

    /* -------------------------------- Deploying ------------------------------- */
    console.log(chalk.blueBright("Deploying projects..."))
    for await (const project of projects) {
        if (!existsSync(`${basePath}/${project.name}`)) {
            console.log(chalk.blueBright(`${project.name} doesn't exist, cloning...`))
            await cmd(`git clone https://github.com/jameslinimk/${project.name}`, `${basePath}`, false, false)
        } else {
            await cmd("git pull", `${basePath}/${project.name}`, false, false)
        }

        const cwd = `${basePath}/${project.name}/server`

        if (!existsSync(`${cwd}/deploy`)) {
            console.log(chalk.red(`No deploy script found at ${cwd}/deploy`))
            process.exit(1)
        }

        console.log(chalk.blueBright(`Deploying ${project.name}...`))
        await cmd("bash ./deploy", cwd, false, true)

        console.log(chalk.green(`Deployed ${project.name}\n`))
    }

    /* ------------------------------ Nginx config ------------------------------ */
    console.log(chalk.blueBright("Updating nginx config..."))

    writeFileSync(
        "temp_conf.conf",
        mainTemplate
            .split("\n")
            .map((line) => {
                if (line.trim() === "# servers here") {
                    return projects
                        .filter((p) => p.host)
                        .map((p) => nginx(p))
                        .join("\n\n")
                }
                return line
            })
            .join("\n")
    )

    await cmd("sudo mv temp_conf.conf /etc/nginx/nginx.conf", undefined, false, false)

    console.log(chalk.blueBright("Done updating nginx config...\n"))

    /* ----------------------------- Launching Nginx ---------------------------- */
    console.log(chalk.blueBright("Launching nginx..."))

    await cmd("sudo nginx -s quit", undefined, true, false)
    await cmd("sudo nginx", undefined, true, false)

    console.log(chalk.blueBright("Nginx launched\n"))
    console.log(chalk.green(`Done! Took ${performance.now() - start}ms`))
}
