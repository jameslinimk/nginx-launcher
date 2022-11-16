import chalk from "chalk"
import detectPort from "detect-port"
import { projects } from "./index.js"

for (const project of [
    ...projects,
    {
        name: "nginx",
        port: 80,
    },
]) {
    const port = await detectPort(project.port)
    if (port !== project.port) {
        console.log(chalk.green(`${project.name} is running`))
    } else {
        console.log(chalk.red(`${project.name} is not running`))
    }
}
