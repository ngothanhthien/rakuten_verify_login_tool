# Custom RAT Database with Rotation Design

**Date:** 2025-02-07
**Status:** Design Complete

## Overview

Migrate from loading a single custom RAT from a remote GIST to storing multiple RATs in the local database with automatic rotation and health-based failure detection.

## Requirements

1. Store multiple custom RATs in local database (SQLite)
2. Per-request round-robin rotation through active RATs
3. Detect dead RATs: 3 consecutive 400 errors → mark DEAD
4. Reset failure counter on any success (200, 401, 403, etc.)
5. Full CRUD API for RAT management
6. Halt credential checking when all RATs are DEAD
7. Reactivating DEAD RAT resets failure count to 0

## Architecture

### Database Schema

New `CustomRat` model in Prisma schema:

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

### Repository Layer

**Interface:** `core/repositories/ICustomRatRepository.ts`

Methods:
- `getActiveRats()` - Returns all ACTIVE RATs
- `findByHash(hash: string)` - Find RAT by hash
- `getNextRat()` - Round-robin selection
- `incrementFailureCount(ratId: number)` - Increment and save
- `markAsDead(ratId: number)` - Set status to DEAD
- `markAsDeadByHash(hash: string)` - Mark dead by hash
- `resetFailureCount(hash: string)` - Reset to 0 on success
- `reactivateRat(ratId: number)` - Set ACTIVE, reset count to 0
- `add(customRat: CustomRat)` - Insert new RAT
- `getAll(filters?)` - List with optional pagination/status filter
- `delete(ratId: number)` - Remove RAT
- `updateStatus(ratId: number, status: string)` - Change status

**Implementation:** `infrastructure/db/prisma/repositories/PrismaCustomRatRepository.ts`

### Application Layer

**CustomRatSelector Service** (`application/services/CustomRatSelector.ts`)

```typescript
class CustomRatSelector {
  private roundRobinIndex = 0;

  async getNextRat(): Promise<CustomRat | null> {
    const activeRats = await this.customRatRepository.getActiveRats();

    if (activeRats.length === 0) {
      throw new Error('No active RATs available. All RATs are DEAD. Cannot continue.');
    }

    const currentIndex = this.roundRobinIndex;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % activeRats.length;

    return activeRats[currentIndex];
  }

  async checkAnyActiveRats(): Promise<boolean> {
    const activeRats = await this.customRatRepository.getActiveRats();
    return activeRats.length > 0;
  }
}
```

Registered as singleton in `container.ts` to maintain round-robin state.

### Infrastructure Layer

**PlaywrightVerify Modifications**

Track consecutive 400 errors per RAT hash:

```typescript
private ratFailureMap = new Map<string, number>();

private async checkCredentialWithProxy(...) {
  const status = response?.status();

  if (status === 400) {
    const ratHash = this.customRat?.hash;
    if (ratHash) {
      const currentCount = this.ratFailureMap.get(ratHash) || 0;
      const newCount = currentCount + 1;
      this.ratFailureMap.set(ratHash, newCount);

      if (newCount >= 3) {
        await this.customRatRepository.markAsDeadByHash(ratHash);
      }
    }
  } else if (status && status >= 200 && status < 500) {
    // Reset on success
    const ratHash = this.customRat?.hash;
    if (ratHash && this.ratFailureMap.has(ratHash)) {
      await this.customRatRepository.resetFailureCount(ratHash);
      this.ratFailureMap.delete(ratHash);
    }
  }
}
```

**HTTP API Controller** (`infrastructure/http/CustomRatController.ts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rats` | List all RATs (optional: ?status=ACTIVE) |
| POST | `/api/rats` | Add new RAT (body: {hash, components}) |
| PUT | `/api/rats/:id` | Update status (body: {status: "ACTIVE"\|"DEAD"}) |
| DELETE | `/api/rats/:id` | Remove RAT |

**Startup Validation** (in `main.ts`)

```typescript
const customRatSelector = container.resolve<CustomRatSelector>('customRatSelector');
const hasActiveRats = await customRatSelector.checkAnyActiveRats();

if (!hasActiveRats) {
  console.error('[Startup] No active RATs found. Add RATs via POST /api/rats');
  process.exit(1);
}
```

## Data Flow

### Credential Check Request Lifecycle

```
1. Worker needs to verify credential
   ↓
2. PlaywrightVerify calls customRatSelector.getNextRat()
   ↓
3. CustomRatSelector queries database for ACTIVE RATs
   ↓
4. Returns next RAT in round-robin rotation
   ↓
5. PlaywrightVerify creates ratOverride script with this RAT
   ↓
6. Credential check executes with custom RAT
   ↓
7a. Response = 400?
    → Increment failure count in Map
    → If count >= 3: markAsDead() in database
   ↓
7b. Response = success (200, 401, 403, etc.)?
    → Reset failure count to 0 in database
    → Clear from in-memory Map
```

### Startup Flow

```
1. Application starts
   ↓
2. Build container with CustomRatSelector
   ↓
3. Call checkAnyActiveRats()
   ↓
4a. No active RATs?
    → Log error message
    → Exit with code 1
   ↓
4b. Has active RATs?
    → Start CredentialCheckRunner
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| All RATs DEAD | Halt credential checking, throw error |
| Duplicate hash on POST | Return 409 Conflict |
| Database connection loss | Log error, continue with last known state |
| Empty database on first run | Startup exits with clear message |
| Concurrent requests | Atomic round-robin index increment |

## Migration Path

**One-time migration script** (`scripts/migrate-rat-from-gist.ts`):

```typescript
async function migrate() {
  const oldRat = await fetchGistAsCustomRat(CUSTOM_RAT_GIST_URL);
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
  console.log('RAT migrated from GIST to database');
}
```

**Code to remove after migration:**
- `utils/fetchGistAsCustomRat.ts`
- GIST URL from `container.ts`
- GIST-related environment variables

## Implementation Order

1. Add `CustomRat` model to Prisma schema
2. Run `prisma migrate`
3. Create `ICustomRatRepository` interface
4. Implement `PrismaCustomRatRepository`
5. Create `CustomRatSelector` service
6. Modify `PlaywrightVerify` for failure tracking
7. Create `CustomRatController` with HTTP endpoints
8. Update `container.ts` registrations
9. Add startup validation to `main.ts`
10. Run migration script
11. Remove old GIST fetching code

## Future Enhancements (Out of Scope)

- Frontend management UI for RATs
- Failure count decay over time
- RAT performance analytics
- Automatic RAT refreshing from external source
- Per-proxy RAT assignment
