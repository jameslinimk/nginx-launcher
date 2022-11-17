import chalk from "chalk"
import express from "express"
import httpProxy from "http-proxy"
import { projects } from "./index.js"
const { createProxyServer } = httpProxy

const apiProxy = createProxyServer()
const app = express()
const port = 1000

projects.forEach((project) => {
    app.all(`${project.location}/*`, (req, res) => {
        apiProxy.web(req, res, { target: `http://localhost:${project.port}` })
    })
})

app.listen(port, () => {
    console.log(chalk.blue(`Server listening at http://localhost:${port}`))
})
