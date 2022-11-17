import chalk from "chalk"
import express from "express"
import httpProxy from "http-proxy"
import { projects } from "./index.js"
const { createProxyServer } = httpProxy

const apiProxy = createProxyServer()
const app = express()
const port = 2436

projects.forEach((project) => {
    console.log(project)
    console.log(`${project.location === "/" ? "" : project.location}/*`)
    app.all(`${project.location === "/" ? "" : project.location}/*`, (req, res) => {
        console.log(`${project.location === "/" ? "" : project.location}/*`)
        apiProxy.web(req, res, { target: `http://localhost:${project.port}` })
    })
})

app.listen(port, () => {
    console.log(chalk.blue(`Server listening at http://localhost:${port}`))
})
