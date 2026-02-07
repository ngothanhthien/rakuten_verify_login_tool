import { PrismaClient } from '../infrastructure/db/prisma/client';
import { fetchGistAsCustomRat } from '../utils';

const CUSTOM_RAT_GIST_URL = process.env.CUSTOM_RAT_GIST_URL || '';

async function migrate() {
  const prisma = new PrismaClient();

  try {
    console.log('[Migration] Fetching RAT from GIST...');
    const oldRat = await fetchGistAsCustomRat(CUSTOM_RAT_GIST_URL);

    console.log('[Migration] Upserting RAT to database...');
    await prisma.customRat.upsert({
      where: { hash: oldRat.hash },
      update: {},
      create: {
        hash: oldRat.hash,
        components: JSON.stringify(oldRat.components),
        status: 'ACTIVE',
        failureCount: 0
      }
    });

    console.log('[Migration] ✓ RAT migrated successfully');
    console.log(`[Migration]   Hash: ${oldRat.hash}`);
    console.log('[Migration] You can now remove CUSTOM_RAT_GIST_URL from .env');
  } catch (error) {
    console.error('[Migration] ✗ Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
