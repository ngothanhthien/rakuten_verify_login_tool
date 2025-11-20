import "dotenv/config";
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/client'
import Database from 'better-sqlite3'

const sqlite = new Database('./dev.db')
const adapter = new PrismaBetterSqlite3(sqlite)
const prisma = new PrismaClient({ adapter })

export { prisma }
