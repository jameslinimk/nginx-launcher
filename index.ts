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

const basePath = "/Users/jamesalin/Documents"
export const projects: Project[] = [
    {
        name: "new-portfolio",
        port: 3000,
        location: "/",
    },
    {
        name: "rogueman",
        port: 8604,
        location: "/rogueman",
    },
]

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const start = performance.now()

    /* -------------------------------- Deploying ------------------------------- */
    console.log(chalk.blue("Deploying projects...\n"))
    for await (const project of projects) {
        const cwd = `${basePath}/${project.name}/server`

        if (!existsSync(`${cwd}/deploy`)) {
            console.log(chalk.red(`No deploy script found at ${cwd}/deploy`))
            process.exit(1)
        }

        console.log(chalk.blueBright(`Deploying ${project.name}...`))
        const { stderr } = await exec("bash ./deploy", { cwd })
        if (stderr) {
            console.log(chalk.red(`Error while deploying ${project.name}`))
            console.log(chalk.gray(stderr))
            process.exit(1)
        }

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
                    .map((project) =>
                        nginx(
                            project.location,
                            project.port.toString(),
                            spaceLength
                        )
                    )
                    .join("\n\n")
            }
            return line
        })
        .join("\n")

    writeFileSync("/usr/local/etc/nginx/nginx.conf", newConfig)

    console.log(chalk.blue("Done updating nginx config...\n"))

    /* ----------------------------- Launching Nginx ---------------------------- */
    console.log(chalk.blue("Launching nginx...\n"))

    await exec("nginx -s quit")
    await exec("nginx")

    console.log(chalk.blue("Nginx launched"))

    console.log(chalk.green(`Done! Took ${performance.now() - start}ms`))
}
