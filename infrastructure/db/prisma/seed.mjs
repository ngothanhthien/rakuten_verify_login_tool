import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_SETTINGS = [
  {
    key: 'credentialCheck.concurrency',
    value: process.env.CREDENTIAL_CHECK_CONCURRENCY || '6',
    type: 'number',
    name: 'Chrome Instance',
    group: 'Credential Check',
  },
]

async function main() {
  await prisma.setting.deleteMany()

  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      create: setting,
      update: setting,
    })
  }

  console.log(`Seeded ${DEFAULT_SETTINGS.length} setting(s).`)
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error('Seed failed:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
