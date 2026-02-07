# Custom RAT Database with Rotation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from loading a single custom RAT from a remote GIST to storing multiple RATs in the local database with automatic round-robin rotation and health-based failure detection.

**Architecture:**
1. Add `CustomRat` Prisma model for storing RATs with status and failure tracking
2. Create `CustomRatSelector` service for round-robin rotation
3. Modify `PlaywrightVerify` to track 400 errors per RAT and mark dead after 3 consecutive failures
4. Add CRUD HTTP API endpoints for RAT management
5. Add startup validation to ensure at least one active RAT exists

**Tech Stack:** Prisma ORM, SQLite, Express.js, TypeScript, Awilix DI container

---

## Task 1: Add CustomRat Model to Prisma Schema

**Files:**
- Modify: `infrastructure/db/prisma/schema.prisma`

**Step 1: Add the CustomRat model to schema**

Add this model after the `Proxy` model (around line 43):

```prisma
model CustomRat {
  id           Int      @id @default(autoincrement())
  hash         String   @unique
  components   String   // JSON string of RatComponents
  status       String   @default("ACTIVE")  // ACTIVE or DEAD
  failureCount Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([status])
}
```

**Step 2: Generate Prisma client**

Run: `npm run prisma:generate`

Expected output: Generated Prisma Client with new CustomRat model to `node_modules/.prisma/client`

**Step 3: Create and apply migration**

Run: `npm run prisma:migrate:dev`

Expected: Prompts for migration name, enter `add_custom_rat`
Expected: Creates migration file in `infrastructure/db/prisma/migrations/`

**Step 4: Commit**

```bash
git add infrastructure/db/prisma/schema.prisma infrastructure/db/prisma/migrations/
git commit -m "feat: add CustomRat model to Prisma schema

Adds database model for storing multiple custom RATs with:
- Unique hash identifier
- JSON components storage
- ACTIVE/DEAD status tracking
- Consecutive failure counter

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create ICustomRatRepository Interface

**Files:**
- Create: `core/repositories/ICustomRatRepository.ts`

**Step 1: Write the repository interface**

```typescript
import { CustomRat as PrismaCustomRat } from '@prisma/client';

export interface CustomRat {
  id: number;
  hash: string;
  components: any; // RatComponents parsed from JSON
  status: 'ACTIVE' | 'DEAD';
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomRatListFilters {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'DEAD';
}

export interface ICustomRatRepository {
  getActiveRats(): Promise<CustomRat[]>;
  findByHash(hash: string): Promise<CustomRat | null>;
  getById(id: number): Promise<CustomRat | null>;
  incrementFailureCount(id: number): Promise<CustomRat>;
  markAsDead(id: number): Promise<CustomRat>;
  markAsDeadByHash(hash: string): Promise<CustomRat | null>;
  resetFailureCount(hash: string): Promise<void>;
  reactivateRat(id: number): Promise<CustomRat>;
  add(data: Omit<CustomRat, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomRat>;
  getAll(filters?: CustomRatListFilters): Promise<{ rats: CustomRat[]; total: number }>;
  delete(id: number): Promise<void>;
  updateStatus(id: number, status: 'ACTIVE' | 'DEAD'): Promise<CustomRat>;
}
```

**Step 2: Commit**

```bash
git add core/repositories/ICustomRatRepository.ts
git commit -m "feat: add ICustomRatRepository interface

Defines repository interface for CustomRat CRUD operations with:
- Active RATs query
- Hash-based lookup
- Failure tracking methods
- Status management
- Pagination support

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Implement PrismaCustomRatRepository

**Files:**
- Create: `infrastructure/db/prisma/repositories/PrismaCustomRatRepository.ts`

**Step 1: Write the repository implementation**

```typescript
import { ICustomRatRepository, CustomRat, CustomRatListFilters } from '../../../core/repositories/ICustomRatRepository';
import { PrismaClient } from '@prisma/client';
import { CustomRat as PrismaCustomRat } from '@prisma/client';

export class PrismaCustomRatRepository implements ICustomRatRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(prismaRat: PrismaCustomRat): CustomRat {
    return {
      id: prismaRat.id,
      hash: prismaRat.hash,
      components: JSON.parse(prismaRat.components),
      status: prismaRat.status as 'ACTIVE' | 'DEAD',
      failureCount: prismaRat.failureCount,
      createdAt: prismaRat.createdAt,
      updatedAt: prismaRat.updatedAt
    };
  }

  async getActiveRats(): Promise<CustomRat[]> {
    const rats = await this.prisma.customRat.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' }
    });
    return rats.map(r => this.toDomain(r));
  }

  async findByHash(hash: string): Promise<CustomRat | null> {
    const rat = await this.prisma.customRat.findUnique({
      where: { hash }
    });
    return rat ? this.toDomain(rat) : null;
  }

  async getById(id: number): Promise<CustomRat | null> {
    const rat = await this.prisma.customRat.findUnique({
      where: { id }
    });
    return rat ? this.toDomain(rat) : null;
  }

  async incrementFailureCount(id: number): Promise<CustomRat> {
    const rat = await this.prisma.customRat.update({
      where: { id },
      data: { failureCount: { increment: 1 } }
    });
    return this.toDomain(rat);
  }

  async markAsDead(id: number): Promise<CustomRat> {
    const rat = await this.prisma.customRat.update({
      where: { id },
      data: { status: 'DEAD' }
    });
    return this.toDomain(rat);
  }

  async markAsDeadByHash(hash: string): Promise<CustomRat | null> {
    try {
      const rat = await this.prisma.customRat.update({
        where: { hash },
        data: { status: 'DEAD' }
      });
      return this.toDomain(rat);
    } catch {
      return null;
    }
  }

  async resetFailureCount(hash: string): Promise<void> {
    await this.prisma.customRat.update({
      where: { hash },
      data: { failureCount: 0 }
    });
  }

  async reactivateRat(id: number): Promise<CustomRat> {
    const rat = await this.prisma.customRat.update({
      where: { id },
      data: { status: 'ACTIVE', failureCount: 0 }
    });
    return this.toDomain(rat);
  }

  async add(data: Omit<CustomRat, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomRat> {
    const rat = await this.prisma.customRat.create({
      data: {
        hash: data.hash,
        components: JSON.stringify(data.components),
        status: data.status || 'ACTIVE',
        failureCount: data.failureCount || 0
      }
    });
    return this.toDomain(rat);
  }

  async getAll(filters?: CustomRatListFilters): Promise<{ rats: CustomRat[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where = filters?.status ? { status: filters.status } : {};

    const [rats, total] = await Promise.all([
      this.prisma.customRat.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.customRat.count({ where })
    ]);

    return {
      rats: rats.map(r => this.toDomain(r)),
      total
    };
  }

  async delete(id: number): Promise<void> {
    await this.prisma.customRat.delete({
      where: { id }
    });
  }

  async updateStatus(id: number, status: 'ACTIVE' | 'DEAD'): Promise<CustomRat> {
    const rat = await this.prisma.customRat.update({
      where: { id },
      data: { status }
    });
    return this.toDomain(rat);
  }
}
```

**Step 2: Commit**

```bash
git add infrastructure/db/prisma/repositories/PrismaCustomRatRepository.ts
git commit -m "feat: implement PrismaCustomRatRepository

Implements ICustomRatRepository using Prisma ORM:
- CRUD operations for CustomRat entities
- JSON serialization for components
- Pagination support
- Status and failure tracking

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Create CustomRatSelector Service

**Files:**
- Create: `application/services/CustomRatSelector.ts`

**Step 1: Write the CustomRatSelector service**

```typescript
import { ICustomRatRepository, CustomRat } from '../../core/repositories/ICustomRatRepository';

export class CustomRatSelector {
  private roundRobinIndex = 0;

  constructor(private customRatRepository: ICustomRatRepository) {}

  async getNextRat(): Promise<CustomRat> {
    const activeRats = await this.customRatRepository.getActiveRats();

    if (activeRats.length === 0) {
      throw new Error('No active RATs available. All RATs are DEAD. Cannot continue.');
    }

    // Atomic round-robin selection
    const currentIndex = this.roundRobinIndex;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % activeRats.length;

    return activeRats[currentIndex];
  }

  async checkAnyActiveRats(): Promise<boolean> {
    const activeRats = await this.customRatRepository.getActiveRats();
    return activeRats.length > 0;
  }

  resetIndex(): void {
    this.roundRobinIndex = 0;
  }
}
```

**Step 2: Commit**

```bash
git add application/services/CustomRatSelector.ts
git commit -m "feat: add CustomRatSelector service

Implements round-robin selection for active RATs:
- Cycles through active RATs per request
- Throws error when no active RATs available
- Provides active RATs check for startup validation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Modify PlaywrightVerify for Failure Tracking

**Files:**
- Modify: `infrastructure/verifier/PlaywrightVerify.ts`

**Step 1: Add failure tracking fields to PlaywrightVerify class**

Add these fields after the existing class fields:

```typescript
private ratFailureMap = new Map<string, number>();  // ratHash -> consecutive 400s
```

**Step 2: Add repository dependency**

Update the constructor to accept `ICustomRatRepository`:

```typescript
import { ICustomRatRepository } from '../../core/repositories/ICustomRatRepository';

// In constructor parameters, add:
private customRatRepository: ICustomRatRepository
```

**Step 3: Add failure tracking method**

Add this method to the class:

```typescript
private async handleRatFailure(ratHash: string): Promise<void> {
  const currentCount = this.ratFailureMap.get(ratHash) || 0;
  const newCount = currentCount + 1;
  this.ratFailureMap.set(ratHash, newCount);

  if (newCount >= 3) {
    await this.customRatRepository.markAsDeadByHash(ratHash);
    console.error(`[PlaywrightVerify] RAT ${ratHash} marked DEAD after 3 consecutive 400s`);
    this.ratFailureMap.delete(ratHash);
  }
}

private async handleRatSuccess(ratHash: string): Promise<void> {
  if (this.ratFailureMap.has(ratHash)) {
    await this.customRatRepository.resetFailureCount(ratHash);
    this.ratFailureMap.delete(ratHash);
  }
}
```

**Step 4: Integrate failure tracking into verify method**

Find the credential check logic and add response status handling. Look for where the HTTP response status is checked and add:

```typescript
// After getting response status
if (response?.status() === 400) {
  const ratHash = this.customRat?.hash;
  if (ratHash) {
    await this.handleRatFailure(ratHash);
  }
} else if (response?.status() && response.status() >= 200 && response.status() < 500) {
  const ratHash = this.customRat?.hash;
  if (ratHash) {
    await this.handleRatSuccess(ratHash);
  }
}
```

**Step 5: Commit**

```bash
git add infrastructure/verifier/PlaywrightVerify.ts
git commit -m "feat: add RAT failure tracking to PlaywrightVerify

Tracks consecutive 400 errors per RAT hash:
- Marks RAT DEAD after 3 consecutive 400s
- Resets failure counter on any success (2xx, 4xx except 400)
- Uses in-memory Map for fast lookups
- Persists state to repository on threshold

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Create CustomRatController

**Files:**
- Create: `infrastructure/http/controllers/CustomRatController.ts`

**Step 1: Write the controller**

```typescript
import { Request, Response } from 'express';
import { ICustomRatRepository } from '../../../core/repositories/ICustomRatRepository';
import { CustomRat } from '../../../core/repositories/ICustomRatRepository';

export class CustomRatController {
  constructor(private customRatRepository: ICustomRatRepository) {}

  async listRats(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const status = req.query.status as 'ACTIVE' | 'DEAD' | undefined;

      const result = await this.customRatRepository.getAll({ page, limit, status });
      res.json({
        rats: result.rats,
        total: result.total,
        page,
        limit
      });
    } catch (error) {
      console.error('[CustomRatController] Error listing RATs:', error);
      res.status(500).json({ error: 'Failed to list RATs' });
    }
  }

  async addRat(req: Request, res: Response): Promise<void> {
    try {
      const { hash, components } = req.body;

      if (!hash || !components) {
        res.status(400).json({ error: 'hash and components are required' });
        return;
      }

      // Check for duplicate
      const existing = await this.customRatRepository.findByHash(hash);
      if (existing) {
        res.status(409).json({ error: 'RAT with this hash already exists' });
        return;
      }

      const newRat = await this.customRatRepository.add({
        hash,
        components,
        status: 'ACTIVE',
        failureCount: 0
      });

      res.status(201).json(newRat);
    } catch (error) {
      console.error('[CustomRatController] Error adding RAT:', error);
      res.status(500).json({ error: 'Failed to add RAT' });
    }
  }

  async updateRatStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (status !== 'ACTIVE' && status !== 'DEAD') {
        res.status(400).json({ error: 'status must be ACTIVE or DEAD' });
        return;
      }

      const rat = await this.customRatRepository.getById(Number(id));
      if (!rat) {
        res.status(404).json({ error: 'RAT not found' });
        return;
      }

      const updatedRat = await this.customRatRepository.updateStatus(Number(id), status);
      res.json(updatedRat);
    } catch (error) {
      console.error('[CustomRatController] Error updating RAT status:', error);
      res.status(500).json({ error: 'Failed to update RAT status' });
    }
  }

  async deleteRat(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const rat = await this.customRatRepository.getById(Number(id));
      if (!rat) {
        res.status(404).json({ error: 'RAT not found' });
        return;
      }

      await this.customRatRepository.delete(Number(id));
      res.json({ success: true });
    } catch (error) {
      console.error('[CustomRatController] Error deleting RAT:', error);
      res.status(500).json({ error: 'Failed to delete RAT' });
    }
  }
}
```

**Step 2: Commit**

```bash
git add infrastructure/http/controllers/CustomRatController.ts
git commit -m "feat: add CustomRatController with CRUD endpoints

Implements HTTP API for RAT management:
- GET /api/rats - List with pagination and status filter
- POST /api/rats - Add new RAT (validates duplicate hash)
- PUT /api/rats/:id - Update status (reactivate or mark dead)
- DELETE /api/rats/:id - Remove RAT

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Register Dependencies in Container

**Files:**
- Modify: `container.ts`

**Step 1: Add imports**

Add at the top with other imports:

```typescript
import { ICustomRatRepository } from './core/repositories/ICustomRatRepository';
import { PrismaCustomRatRepository } from './infrastructure/db/prisma/repositories/PrismaCustomRatRepository';
import { CustomRatSelector } from './application/services/CustomRatSelector';
import { CustomRatController } from './infrastructure/http/controllers/CustomRatController';
```

**Step 2: Remove old GIST fetch logic**

Find and remove these lines (around line 14-29):

```typescript
// DELETE THESE LINES:
// import { fetchGistAsCustomRat } from './utils'
// let customRat;
// try {
//   customRat = await fetchGistAsCustomRat(CUSTOM_RAT_GIST_URL + '?v=' + Date.now())
// } catch (error) {
//   console.error('[Startup] Failed to fetch custom RAT:', error)
// }
```

**Step 3: Register new dependencies**

Add to container registrations after other repository registrations:

```typescript
container.register({
  // ... existing registrations ...

  // Custom RAT Repository
  customRatRepository: asClass(PrismaCustomRatRepository).scoped(),

  // Custom RAT Selector
  customRatSelector: asClass(CustomRatSelector).singleton(),

  // Custom RAT Controller
  customRatController: asClass(CustomRatController).scoped(),
});
```

**Step 4: Commit**

```bash
git add container.ts
git commit -m "refactor: replace GIST RAT loading with database-backed system

- Remove fetchGistAsCustomRat import and usage
- Register PrismaCustomRatRepository (scoped)
- Register CustomRatSelector (singleton for round-robin state)
- Register CustomRatController (scoped)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Register HTTP Routes

**Files:**
- Modify: `main.ts`

**Step 1: Import controller**

Add near other controller imports:

```typescript
import { CustomRatController } from './infrastructure/http/controllers/CustomRatController';
```

**Step 2: Resolve controller from container**

Add after other controller resolutions:

```typescript
const customRatController = container.resolve<CustomRatController>('customRatController');
```

**Step 3: Register routes**

Add routes after other API routes:

```typescript
// Custom RAT management
app.get('/api/rats', customRatController.listRats.bind(customRatController));
app.post('/api/rats', customRatController.addRat.bind(customRatController));
app.put('/api/rats/:id', customRatController.updateRatStatus.bind(customRatController));
app.delete('/api/rats/:id', customRatController.deleteRat.bind(customRatController));
```

**Step 4: Commit**

```bash
git add main.ts
git commit -m "feat: register Custom RAT HTTP routes

Adds REST API endpoints:
- GET /api/rats
- POST /api/rats
- PUT /api/rats/:id
- DELETE /api/rats/:id

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Add Startup Validation

**Files:**
- Modify: `main.ts`

**Step 1: Import selector**

Add to imports:

```typescript
import { CustomRatSelector } from './application/services/CustomRatSelector';
```

**Step 2: Add startup check**

Add this check after container creation but before starting the credential check runner:

```typescript
// Validate at least one active RAT exists
const customRatSelector = container.resolve<CustomRatSelector>('customRatSelector');
const hasActiveRats = await customRatSelector.checkAnyActiveRats();

if (!hasActiveRats) {
  console.error('[Startup] No active RATs found in database.');
  console.error('[Startup] Please add at least one RAT using: POST /api/rats');
  console.error('[Startup] Example: curl -X POST http://localhost:3000/api/rats -H "Content-Type: application/json" -d \'{"hash":"your-hash","components":{}}\'');
  process.exit(1);
}

console.log('[Startup] Custom RAT system initialized with active RATs');
```

**Step 3: Commit**

```bash
git add main.ts
git commit -m "feat: add startup validation for active RATs

Application exits with error if no active RATs found.
Provides clear instructions for adding RATs via API.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Update PlaywrightVerify to Use CustomRatSelector

**Files:**
- Modify: `infrastructure/verifier/PlaywrightVerify.ts`

**Step 1: Update constructor to use CustomRatSelector**

Change constructor to accept `CustomRatSelector` instead of raw customRat:

```typescript
import { CustomRatSelector } from '../../application/services/CustomRatSelector';

// In constructor:
private customRatSelector: CustomRatSelector

// Remove old customRat field, add:
private customRat?: any;  // Will be loaded per request
```

**Step 2: Add method to load RAT per request**

Add this method:

```typescript
private async loadCustomRatForRequest(): Promise<any> {
  try {
    return await this.customRatSelector.getNextRat();
  } catch (error) {
    if (error instanceof Error && error.message.includes('No active RATs')) {
      console.error('[PlaywrightVerify] All RATs are DEAD. Cannot continue verification.');
      throw error;
    }
    return null;
  }
}
```

**Step 3: Update verify method to load RAT per request**

Find where customRat is used and add loading before each verification:

```typescript
// Load fresh RAT for this request
this.customRat = await this.loadCustomRatForRequest();

// ... rest of verification logic using this.customRat
```

**Step 4: Commit**

```bash
git add infrastructure/verifier/PlaywrightVerify.ts
git commit -m "refactor: use CustomRatSelector for per-request RAT loading

Each verification request now gets a fresh RAT from round-robin rotation.
Throws error when all RATs are DEAD.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Create Migration Script from GIST

**Files:**
- Create: `scripts/migrate-rat-from-gist.ts`

**Step 1: Write the migration script**

```typescript
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
```

**Step 2: Add script to package.json**

Add to `scripts` section in package.json:

```json
"migrate-rat": "tsx scripts/migrate-rat-from-gist.ts"
```

**Step 3: Commit**

```bash
git add scripts/migrate-rat-from-gist.ts package.json
git commit -m "feat: add GIST to database migration script

Provides one-time migration from GIST-based RAT to database.
Run with: npm run migrate-rat

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Update Container to Pass Prisma to Repository

**Files:**
- Modify: `container.ts`

**Step 1: Update PrismaCustomRatRepository registration**

Change the registration to pass PrismaClient:

```typescript
// Find the prisma instance registration (should exist for other repositories)
// Then update customRatRepository registration:

container.register({
  // ... existing registrations ...

  customRatRepository: asClass(PrismaCustomRatRepository).scoped(),
}).register({
  // This ensures PrismaClient is injected into the repository
  // The scoped lifetime ensures each request gets its own repository with fresh Prisma instance
});
```

Note: The existing container pattern should already handle Prisma injection via Awilix's automatic dependency injection. If `PrismaCustomRatRepository` constructor has `prisma: PrismaClient`, Awilix will inject it automatically.

**Step 2: Commit**

```bash
git add container.ts
git commit -m "fix: ensure PrismaClient injection to CustomRatRepository

Awilix automatically injects PrismaClient based on constructor parameter.
Repository remains scoped for proper lifecycle management.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Clean Up Old GIST Code

**Files:**
- Delete: `utils/fetchGistAsCustomRat.ts` (if exists as separate file)
- Modify: `utils/index.ts` (if function is exported from there)
- Modify: `.env.example` (remove or mark as deprecated)

**Step 1: Remove fetchGistAsCustomRat from utils**

If `fetchGistAsCustomRat` is in `utils/index.ts`, remove it:

```typescript
// DELETE THIS FUNCTION:
// export async function fetchGistAsCustomRat(gistUrl: string): Promise<import('./ratOverride').CustomRat> {
//   ... entire function ...
// }
```

**Step 2: Update .env.example**

Add comment marking CUSTOM_RAT_GIST_URL as deprecated:

```bash
# CUSTOM_RAT_GIST_URL=https://gist.githubusercontent.com/.../raw/rat.json
# ^ DEPRECATED: Use POST /api/rats to add custom RATs instead
```

**Step 3: Update ratOverride if it references GIST**

Check `utils/ratOverride.ts` and remove any GIST-related logic if it exists there.

**Step 4: Commit**

```bash
git add utils/index.ts .env.example
git commit -m "refactor: remove deprecated GIST fetching code

- Remove fetchGistAsCustomRat function
- Mark CUSTOM_RAT_GIST_URL as deprecated in .env.example
- Cleanup related GIST logic

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 14: Run Migration and Test

**Step 1: Run the migration script**

```bash
npm run migrate-rat
```

Expected output:
```
[Migration] Fetching RAT from GIST...
[Migration] Upserting RAT to database...
[Migration] ✓ RAT migrated successfully
[Migration]   Hash: <some-hash>
[Migration] You can now remove CUSTOM_RAT_GIST_URL from .env
```

**Step 2: Start the application**

```bash
npm run dev
```

Expected output includes:
```
[Startup] Custom RAT system initialized with active RATs
```

**Step 3: Test API endpoints**

In another terminal:

```bash
# List all RATs
curl http://localhost:3000/api/rats

# Add a new RAT (example)
curl -X POST http://localhost:3000/api/rats \
  -H "Content-Type: application/json" \
  -d '{"hash":"test-hash-123","components":{"version":1}}'

# Update status
curl -X PUT http://localhost:3000/api/rats/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"DEAD"}'

# Delete a RAT
curl -X DELETE http://localhost:3000/api/rats/1
```

**Step 4: Verify error handling**

Delete all RATs from database (via API or directly), then restart application:

```bash
# Should exit with error
npm run dev
```

Expected output:
```
[Startup] No active RATs found in database.
[Startup] Please add at least one RAT using: POST /api/rats
...
[exits with code 1]
```

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify Custom RAT system integration

- Migration from GIST successful
- Application starts with active RATs
- API endpoints functional
- Startup validation working

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 15: Documentation Updates

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update Key Concepts section**

Find the "Custom RAT" section and update it:

```markdown
**Custom RAT System**: The application now stores multiple custom RATs (Rakuten Account Transfer hashes) in the database for GPU fingerprinting override. RATs are managed via HTTP API (`/api/rats`) and automatically rotated using round-robin. Each worker fetches a fresh RAT per request. The system tracks consecutive 400 errors and marks RATs as DEAD after 3 failures. Failure counters reset on any success (200, 401, 403, etc.). Application exits on startup if no active RATs exist.
```

**Step 2: Update Environment Variables section**

Update or add:

```markdown
## Environment Variables

### Custom RAT System (DEPRECATED)
- `CUSTOM_RAT_GIST_URL` - **DEPRECATED**. Previously used to fetch single RAT from GIST. Use `POST /api/rats` endpoint instead.

### New: Add RATs via API
```bash
# Add a custom RAT
curl -X POST http://localhost:3000/api/rats \
  -H "Content-Type: application/json" \
  -d '{"hash":"your-rat-hash","components":{...}}'
```
```

**Step 3: Update Architecture section**

Update the database models list:

```markdown
**Prisma with SQLite** - Schema defined in `infrastructure/db/prisma/schema.prisma`:

- `Credential` - id, email, password, status, checkedAt, processingBy, claimedAt
- `Setting` - key, name, value, type, group (application settings)
- `Proxy` - server, username, password, status, country (proxy pool)
- `CustomRat` - id, hash, components, status, failureCount (custom RAT storage)
```

**Step 4: Add API documentation section**

Add new section:

```markdown
## Custom RAT API

### Management Endpoints

**GET /api/rats** - List all RATs
- Query params: `page` (default: 1), `limit` (default: 50), `status` (ACTIVE|DEAD)
- Returns: `{ rats: CustomRat[], total: number, page: number, limit: number }`

**POST /api/rats** - Add new RAT
- Body: `{ hash: string, components: object }`
- Returns: Created `CustomRat` object
- Error 409: Hash already exists

**PUT /api/rats/:id** - Update RAT status
- Body: `{ status: "ACTIVE" | "DEAD" }`
- Setting to ACTIVE resets failureCount to 0

**DELETE /api/rats/:id** - Remove RAT
- Returns: `{ success: true }`
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for database-backed RAT system

- Document new CustomRat model
- Update environment variables (mark GIST as deprecated)
- Add API endpoint documentation
- Update architecture overview

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Final Verification

**Step 1: Run full test suite**

```bash
npm test
```

**Step 2: Build production bundle**

```bash
npm run build
```

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete Custom RAT database rotation system

Full implementation complete:
- Database schema with CustomRat model
- Round-robin rotation via CustomRatSelector
- Failure tracking (3x 400 = DEAD)
- Full CRUD API
- Startup validation
- Migration script from GIST
- Documentation updates

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

This implementation plan migrates the custom RAT system from a single GIST-loaded value to a robust database-backed rotation system with:

1. **Multi-RAT storage** - Store unlimited RATs in SQLite
2. **Round-robin rotation** - Even distribution across all active RATs
3. **Health monitoring** - Auto-detect and disable failing RATs
4. **Full API** - Complete CRUD management
5. **Production safety** - Startup validation prevents broken deployments

**Total estimated time:** 2-3 hours for full implementation including testing.
