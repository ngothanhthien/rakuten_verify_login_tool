// prisma.config.ts (đặt cạnh package.json backend)
import "dotenv/config"
import { defineConfig } from "prisma/config"
import path from "path"

const dbPath = path.join(process.cwd(), "dev.db")

export default defineConfig({
  schema: "./schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? `file:${dbPath}`,
  },
})
