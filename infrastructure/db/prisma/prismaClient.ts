import { PrismaClient } from "@prisma/client"

// Standard Prisma Client initialization without native adapter
// This allows for better portability (copying query engine binaries)
// Standard Prisma Client initialization without native adapter
// This allows for better portability (copying query engine binaries)
const prisma = new PrismaClient({
  log: ["error", "warn"]
})

export { prisma }
