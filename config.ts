import { readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
export const __dirname = dirname(__filename)

export interface Project {
    name: string
    port: number
    host?: string
}

export const basePath = "/home/ec2-user/projects"
export const projects: Project[] = [
    {
        name: "portfolio",
        port: 3000,
        host: null,
    },
    {
        name: "rogueman",
        port: 8604,
        host: "rm",
    },
    {
        name: "chess-ai",
        port: 3252,
        host: "chess",
    },
]

export const mainTemplate = readFileSync(join(__dirname, "/templates/main/nginx.conf"), "utf-8")
export const subTemplate = readFileSync(join(__dirname, "/templates/sub/nginx.conf"), "utf-8")
