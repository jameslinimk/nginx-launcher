import chalk from "chalk"
import { spawn } from "child_process"
import { existsSync, readFileSync, statSync, writeFileSync } from "fs"
import { join } from "path"
import { fileURLToPath } from "url"
import { Project, __dirname, basePath, mainTemplate, projects, subTemplate } from "./config.js"

const nginx = (project: Project) =>
    subTemplate
        .replaceAll("${name}", project.name)
        .replaceAll("${port}", `${project.port}`)
        .replaceAll("${host}", project.host)
        .split("\n")
        .map((l) => `    ${l}`)

const cmd = (command: string, cwd: string | null, ignoreErr = false, log = true): Promise<void> =>
    new Promise((resolve) => {
        const cmd = command.split(" ")[0]
        const args = command.split(" ").slice(1)

        const ex = spawn(cmd, args, { cwd })
        ex.on("exit", (code) => {
            if (!ignoreErr && code !== 0) {
                console.log(chalk.red(`Error running "${command}" in "${cwd}": exited with code ${code}`))
                process.exit(1)
            }

            resolve()
        })

        if (log) {
            ex.stdout.on("data", (data) => {
                process.stdout.write(chalk.gray(data.toString()))
            })

            ex.stderr.on("data", (data) => {
                process.stdout.write(chalk.gray.bgHex("#ffac9a")(data.toString()))
            })
        }
    })

const runDeploy = async (command: string, cwd: string, project: Project): Promise<void> =>
    new Promise((resolve) => {
        const logFile = join(__dirname, `logs/${project.name}.${Date.now()}.log`)
        const cmd = command.split(" ")[0]
        const args = command.split(" ").slice(1)

        const ex = spawn(cmd, args, { cwd })
        ex.on("exit", (code) => {
            if (code !== 0) {
                console.log(chalk.red(`Error running "${command}" in "${cwd}": exited with code ${code}`))
                process.exit(1)
            }

            console.log(chalk.green(`Deployed ${project.name} successfully, log saved to ${logFile}`))
            writeFileSync(logFile, log)
            resolve()
        })

        let log = ""
        const updateLog = (data: any) => {
            log += data.toString()
            console.log(`${project.name} test`)
        }

        ex.stdout.on("data", updateLog)
        ex.stderr.on("data", updateLog)
    })

const metaPath = join(__dirname, "meta.json")
const metaFile: Record<string, number> = (() => {
    if (existsSync(metaPath)) {
        return JSON.parse(readFileSync(join(__dirname, "meta.json"), "utf-8"))
    }

    writeFileSync(metaPath, "{}")
    return {}
})()

const main = async () => {
    const start = performance.now()

    /* -------------------------------- Updating -------------------------------- */
    console.log(chalk.blueBright("Updating projects..."))
    const deploys = []
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

        const stats = statSync(`${cwd}/deploy`)
        if (stats.mtimeMs > (metaFile?.[project.name] || 0)) {
            deploys.push(runDeploy("bash ./deploy", cwd, project))
            metaFile[project.name] = stats.mtimeMs
            continue
        }

        console.log(chalk.green(`Already built ${project.name}, skipping...`))
    }
    console.log(chalk.blueBright("Done updating projects...\n"))

    /* -------------------------------- Deploying ------------------------------- */
    console.log(chalk.blueBright("Deploying projects..."))
    await Promise.all(deploys)
    console.log(chalk.blueBright("Done deploying projects...\n"))
    writeFileSync(metaPath, JSON.stringify(metaFile))

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

    await cmd("sudo mv temp_conf.conf /etc/nginx/nginx.conf", null, false, false)

    console.log(chalk.blueBright("Done updating nginx config...\n"))

    /* ----------------------------- Launching Nginx ---------------------------- */
    console.log(chalk.blueBright("Launching nginx..."))

    await cmd("sudo nginx -s quit", null, true, false)
    await cmd("sudo nginx", null, true, false)

    console.log(chalk.blueBright("Nginx launched\n"))
    console.log(chalk.green(`Done! Took ${performance.now() - start}ms`))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await main()
}
