import chalk from "chalk"
import { exec as _exec } from "child_process"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { promisify } from "util"
const exec = promisify(_exec)

const nginx = (project: Project) => `    # ${project.name} server
    server {
        server_name ${project.host}.jamesalin.com;
        listen 443 ssl;

        ssl_certificate /etc/letsencrypt/live/${project.host}.jamesalin.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${project.host}.jamesalin.com/privkey.pem;
        include /etc/letsencrypt/options-ssl-nginx.conf;
        ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

        location / {
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Host $host;
            proxy_set_header X-NginX-Proxy true;
            proxy_pass http://localhost:${project.port};
            proxy_redirect http://localhost:${project.port} https://$server_name;
        }
    }

    # Redirect http to https
    server {
        if ($host = ${project.host}.jamesalin.com) {
            return 301 https://${project.host}.jamesalin.com$request_uri;
        }

        listen 80;
        server_name ${project.host}.jamesalin.com;
        return 404;
    }`

interface Project {
    name: string
    port: number
    host?: string
}

const basePath = "/home/ec2-user/home"
export const projects: Project[] = [
    {
        name: "rogueman",
        port: 8604,
        host: "rm",
    },
    {
        name: "new-portfolio",
        port: 3000,
        host: null,
    },
    {
        name: "chess-ai",
        port: 3252,
        host: "chess",
    }
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
    let config = readFileSync("./nginx.conf", "utf-8")
    config = config
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
    writeFileSync("/etc/nginx/nginx.conf", config)
    console.log(chalk.blueBright("Done updating nginx config...\n"))

    /* ----------------------------- Launching Nginx ---------------------------- */
    console.log(chalk.blueBright("Launching nginx..."))
    await exec("sudo nginx -s quit").catch(() => {})
    await exec("sudo nginx").catch(() => {})
    console.log(chalk.blueBright("Nginx launched\n"))

    console.log(chalk.green(`Done! Took ${performance.now() - start}ms`))
}
