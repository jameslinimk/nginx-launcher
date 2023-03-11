import chalk from "chalk"
import { exec } from "child_process"
import { existsSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { Project, basePath, mainTemplate, projects, subTemplate } from "./config.js"

const nginx = (project: Project) =>
    subTemplate.replaceAll("${name}", project.name).replaceAll("${port}", `${project.port}`)

const cmd = (command: string, cwd: string | null, ignoreErr = false, log = true): Promise<void> =>
    new Promise((resolve) => {
        exec(command, { cwd }, (err, stdout, stderr) => {
            const e = err || stderr
            if (!ignoreErr && e) {
                console.log(chalk.red(`Error running ${command} in ${cwd}: ${e}`))
                process.exit(1)
            }

            if (log && stdout) console.log(chalk.gray(stdout))
        }).on("exit", (code) => {
            if (code === 0) {
                resolve()
            } else {
                console.log(chalk.red(`Error running ${command} in ${cwd}: exited with code ${code}`))
                process.exit(1)
            }
        })
    })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const start = performance.now()

    /* -------------------------------- Deploying ------------------------------- */
    console.log(chalk.blueBright("Deploying projects..."))
    for await (const project of projects) {
        await cmd("git pull", `${basePath}/${project.name}`, true, false)

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

    await cmd("sudo mv temp_conf.conf /etc/nginx/nginx.conf", null, true, false)

    console.log(chalk.blueBright("Done updating nginx config...\n"))

    /* ----------------------------- Launching Nginx ---------------------------- */
    console.log(chalk.blueBright("Launching nginx..."))

    await cmd("sudo nginx -s quit", null, true, false)
    await cmd("sudo nginx", null, true, false)

    console.log(chalk.blueBright("Nginx launched\n"))
    console.log(chalk.green(`Done! Took ${performance.now() - start}ms`))
}
