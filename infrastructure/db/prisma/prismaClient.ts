import "dotenv/config"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "./generated/client"

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!, // file:./dev.db
})

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
})

export { prisma }
