import chalk from "chalk"
import { exec as _exec } from "child_process"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { fileURLToPath } from "url"
import { promisify } from "util"
const exec = promisify(_exec)

interface Project {
    name: string
    port: number
    location: string
}

const basePath = "/home/ec2-user/home"
export const projects: Project[] = [
    {
        name: "rogueman",
        port: 8604,
        location: "/rogueman",
    },
    {
        name: "new-portfolio",
        port: 3000,
        location: "/",
    },
]

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const start = performance.now()

    /* -------------------------------- Deploying ------------------------------- */
    console.log(chalk.blueBright("Deploying projects..."))
    for await (const project of projects) {
        await exec("git pull", { cwd: `${basePath}/${project.name}` })

        const cwd = `${basePath}/${project.name}/server`

        if (!existsSync(`${cwd}/deploy`)) {
            console.log(chalk.red(`No deploy script found at ${cwd}/deploy`))
            process.exit(1)
        }

        console.log(chalk.blueBright(`Deploying ${project.name}...`))
        await exec("bash ./deploy", { cwd })

        console.log(chalk.green(`Deployed ${project.name}\n`))
    }

    /* ------------------------------ Nginx config ------------------------------ */
    console.log(chalk.blueBright("Updating nginx config..."))
    const config = readFileSync("./nginx.conf", "utf-8")
    writeFileSync("/etc/nginx/nginx.conf", config)
    console.log(chalk.blueBright("Done updating nginx config...\n"))

    /* ----------------------------- Launching Nginx ---------------------------- */
    console.log(chalk.blueBright("Launching nginx..."))
    await exec("sudo nginx -s quit").catch(() => {})
    await exec("sudo nginx").catch(() => {})
    console.log(chalk.blueBright("Nginx launched\n"))

    /* ---------------------------- Launching server ---------------------------- */
    console.log(chalk.blueBright("Launching server..."))
    const tmux_name = "main_server"
    await exec(`tmux kill-session -t ${tmux_name}`, { cwd: resolve() }).catch(() => {})
    await exec(`tmux new -d -s ${tmux_name} "pnpm run serve"`, { cwd: resolve() }).catch(() => {})
    console.log(chalk.blueBright("Server launched\n"))

    console.log(chalk.green(`Done! Took ${performance.now() - start}ms`))
}
