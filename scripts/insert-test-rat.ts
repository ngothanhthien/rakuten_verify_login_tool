import { PrismaClient } from '@prisma/client';
import { generateRatHash } from '../utils/generateRatHash';

async function insertTestRat() {
  const prisma = new PrismaClient();

  try {
    // Create a simple test RAT
    const testComponents = {
      platform: { value: 'Linux x86_64' },
      hardwareConcurrency: { value: 8 },
      deviceMemory: { value: 8 },
      screenResolution: { value: [1920, 1080] },
      colorDepth: { value: 24 },
      timezone: { value: 'UTC' },
      languages: { value: ['en-US', 'en'] },
      fonts: { value: ['Arial', 'Times New Roman', 'Courier New'] }
    };

    const hash = generateRatHash(testComponents);

    console.log('[Test RAT] Inserting test RAT with hash:', hash);

    await prisma.customRat.upsert({
      where: { hash },
      update: {},
      create: {
        hash,
        components: JSON.stringify(testComponents),
        status: 'ACTIVE',
        failureCount: 0
      }
    });

    console.log('[Test RAT] ✓ Test RAT inserted successfully');
    console.log('[Test RAT]   Hash:', hash);
    console.log('[Test RAT]   Components:', JSON.stringify(testComponents, null, 2));
  } catch (error) {
    console.error('[Test RAT] ✗ Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

insertTestRat();
