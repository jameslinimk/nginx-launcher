import chalk from "chalk"
import detectPort from "detect-port"
import { readFileSync } from "fs"
import { projects } from "./index.js"

if (readFileSync("/var/run/nginx.pid", "utf-8").length !== 0) {
    console.log(chalk.red("nginx is running"))
} else {
    console.log(chalk.red("nginx is not running"))
}

for (const project of projects) {
    const port = await detectPort(project.port)
    if (port !== project.port) {
        console.log(chalk.green(`${project.name} is running`))
    } else {
        console.log(chalk.red(`${project.name} is not running`))
    }
}
