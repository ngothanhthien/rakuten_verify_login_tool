// prisma.config.ts
import { config } from "dotenv"
import { defineConfig } from "prisma/config"
import path from "path"

// Load .env from project root (when running from prisma directory, go 3 levels up)
const rootDir = path.resolve(__dirname, "../../..")
config({ path: path.join(rootDir, ".env") })

// Database file will be in project root
const dbPath = path.join(rootDir, "dev.db")

export default defineConfig({
  schema: "./schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? `file:${dbPath}`,
  },
})
