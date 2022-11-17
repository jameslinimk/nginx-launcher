import chalk from "chalk"
import { exec as _exec } from "child_process"
import { existsSync, readFileSync, writeFileSync } from "fs"
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
    console.log(chalk.blue("Deploying projects..."))
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
    console.log(chalk.blue("Updating nginx config...\n"))
    const nginx = (location: string, port: string, spaces: number) =>
        `location ${location} {
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_set_header X-NginX-Proxy true;
    proxy_pass http://localhost:${port};
    proxy_redirect http://localhost:${port} https://$server_name;
}`
            .split("\n")
            .map((l) => `${" ".repeat(spaces)}${l}`)
            .join("\n")

    const config = readFileSync("./nginx.conf", "utf-8")
    const newConfig = config
        .split("\n")
        .map((line) => {
            if (line.trim() === "# locations here") {
                const spaceLength = line.length - line.trimStart().length
                return projects
                    .map((project) => nginx(project.location, project.port.toString(), spaceLength))
                    .join("\n\n")
            }
            return line
        })
        .join("\n")

    writeFileSync("/etc/nginx/nginx.conf", newConfig)

    console.log(chalk.blue("Done updating nginx config...\n"))

    /* ----------------------------- Launching Nginx ---------------------------- */
    console.log(chalk.blue("Launching nginx...\n"))

    await exec("sudo nginx -s quit").catch(() => {})
    await exec("sudo nginx").catch(() => {})

    console.log(chalk.blue("Nginx launched"))

    console.log(chalk.green(`Done! Took ${performance.now() - start}ms`))
}
