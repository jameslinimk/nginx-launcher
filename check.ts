import chalk from "chalk"
import detectPort from "detect-port"
import { projects } from "./config.js"

for (const project of [{ name: "nginx (80)", port: 80 }, { name: "nginx (443)", port: 443 }, ...projects]) {
    const port = await detectPort(project.port)
    if (port !== project.port) {
        console.log(chalk.green(`${project.name} is running`))
    } else {
        console.log(chalk.red(`${project.name} is not running`))
    }
}
