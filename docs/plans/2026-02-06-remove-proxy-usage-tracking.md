# Remove Proxy Usage Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `usageCount` and `usedAt` tracking from proxy system to improve performance, implementing dynamic worker concurrency based on total available proxies.

**Architecture:**
- Calculate worker count dynamically: `MIN(total_proxies / 2, 40)`
- Distribute proxies evenly across workers
- Remove all writes to `usageCount` and `usedAt` fields
- Drop columns from database schema

**Tech Stack:** TypeScript, Prisma ORM, SQLite, Awilix DI

---

## Task 1: Create Migration to Drop Columns

**Files:**
- Create: `infrastructure/db/prisma/migrations/<timestamp>_drop_proxy_usage_fields/migration.sql`

**Step 1: Generate blank Prisma migration**

Run: `npm run prisma:migrate:dev -- --name drop_proxy_usage_fields --create-only`

Expected: New migration folder created with `_migration.sql` file

**Step 2: Write migration SQL**

Replace contents of `infrastructure/db/prisma/migrations/<timestamp>_drop_proxy_usage_fields/migration.sql`:

```sql
-- DropIndex
DROP INDEX IF EXISTS "Proxy_usedAt_idx";

-- AlterTable
ALTER TABLE "Proxy" DROP COLUMN "usageCount";
ALTER TABLE "Proxy" DROP COLUMN "usedAt";
```

**Step 3: Update Prisma schema**

Modify: `infrastructure/db/prisma/schema.prisma:34-44`

Replace the Proxy model with:

```prisma
model Proxy {
  id Int @id @default(autoincrement())
  server String
  username String?
  password String?
  status String @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Step 4: Generate Prisma client**

Run: `npm run prisma:generate`

Expected: "Generated Prisma Client" output

**Step 5: Commit**

```bash
git add infrastructure/db/prisma/
git commit -m "refactor: remove usageCount and usedAt from Proxy model"
```

---

## Task 2: Update Proxy Entity

**Files:**
- Modify: `core/entities/Proxy.ts`

**Step 1: Read current Proxy entity**

Run: `cat core/entities/Proxy.ts`

**Step 2: Remove usageCount and usedAt from entity**

Modify the Proxy entity to remove these fields. The create method should only accept:
- id (optional)
- server
- username (optional)
- password (optional)
- status (optional)

**Step 3: Commit**

```bash
git add core/entities/Proxy.ts
git commit -m "refactor: remove usageCount and usedAt from Proxy entity"
```

---

## Task 3: Rewrite assignToWorkers Method

**Files:**
- Modify: `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts:135-167`

**Step 1: Remove markInUse method**

Delete lines 169-179 in `PrismaProxyRepository.ts`:
```typescript
private async markInUse(tx: any, proxyId: number): Promise<void> {
  await tx.proxy.update({
    where: { id: proxyId },
    data: {
      status: 'IN_USE',
      usedAt: new Date(),
      usageCount: { increment: 1 },
      updatedAt: new Date()
    }
  });
}
```

**Step 2: Rewrite assignToWorkers with new logic**

Replace entire `assignToWorkers` method (lines 135-167) with:

```typescript
async assignToWorkers(): Promise<Map<string, import("../../../../core/value-objects/WorkerProxyAssignment").WorkerProxyAssignment>> {
  const { createWorkerProxyAssignment } = await import('../../../../core/value-objects/WorkerProxyAssignment');

  return await prisma.$transaction(async (tx) => {
    // Count total active proxies
    const countResult = await tx.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*) as count FROM "Proxy" WHERE status = 'ACTIVE'
    `;
    const totalProxies = countResult[0].count;

    // Edge case: fewer than 2 proxies means no workers
    if (totalProxies < 2) {
      return new Map();
    }

    // Calculate: max 40 workers, proxies distributed evenly
    const maxConcurrency = 40;
    const workerCount = Math.min(Math.floor(totalProxies / 2), maxConcurrency);
    const proxiesPerWorker = Math.ceil(totalProxies / workerCount);

    // Fetch required proxies
    const proxies = await tx.$queryRaw<any[]>`
      SELECT * FROM "Proxy"
      WHERE status = 'ACTIVE'
      ORDER BY id ASC
      LIMIT ${workerCount * proxiesPerWorker}
    `;

    // Distribute to workers
    const assignments = new Map();
    for (let i = 0; i < workerCount; i++) {
      const start = i * proxiesPerWorker;
      const end = start + proxiesPerWorker;
      const workerProxies = proxies.slice(start, end);

      // Map raw rows to entities
      const proxyEntities = workerProxies.map(p => this.toEntity(p));

      assignments.set(`worker-${i + 1}`, createWorkerProxyAssignment(...proxyEntities));
    }

    return assignments;
  });
}
```

**Step 3: Update toEntity method**

Modify `toEntity` method (around line 181) to remove `usedAt` handling:

```typescript
private toEntity(model: any) {
  return Proxy.create({
    id: model.id,
    server: model.server,
    username: model.username,
    password: model.password,
    status: model.status
  });
}
```

**Step 4: Update findById query**

Modify line 27 in `findById` method to remove `usageCount` and `usedAt`:

```typescript
SELECT id, server, username, password, status FROM "Proxy" WHERE id = ${id} LIMIT 1
```

**Step 5: Commit**

```bash
git add infrastructure/db/prisma/repositories/PrismaProxyRepository.ts
git commit -m "refactor: rewrite assignToWorkers with dynamic concurrency calculation"
```

---

## Task 4: Simplify rotate Method

**Files:**
- Modify: `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts:84-108`

**Step 1: Rewrite rotate method**

Replace the entire `rotate` method with:

```typescript
async rotate(oldProxyId: number, newProxyId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Set old proxy back to ACTIVE
    await tx.$queryRaw`
      UPDATE "Proxy"
      SET status = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${oldProxyId}
    `;

    // Set new proxy to IN_USE
    await tx.$queryRaw`
      UPDATE "Proxy"
      SET status = 'IN_USE', "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${newProxyId}
    `;
  });
}
```

**Step 2: Commit**

```bash
git add infrastructure/db/prisma/repositories/PrismaProxyRepository.ts
git commit -m "refactor: simplify rotate method, remove usage tracking"
```

---

## Task 5: Update Frontend Types

**Files:**
- Modify: `frontend/src/types/index.d.ts`

**Step 1: Remove usageCount and usedAt from Proxy type**

Find the Proxy type definition and remove the fields:

```typescript
export interface Proxy {
  id: number;
  server: string;
  username?: string;
  password?: string;
  status: string;
  // Remove these lines:
  // usageCount: number;
  // usedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/index.d.ts
git commit -m "refactor: remove usageCount and usedAt from frontend Proxy type"
```

---

## Task 6: Update ProxiesPage Vue Component

**Files:**
- Modify: `frontend/src/pages/ProxiesPage.vue`

**Step 1: Remove usageCount and usedAt columns from table**

Find the table definition and remove the columns showing `usageCount` and `usedAt`.

Look for `<th>` or `<td>` elements rendering these fields and remove them.

**Step 2: Commit**

```bash
git add frontend/src/pages/ProxiesPage.vue
git commit -m "refactor: remove usageCount and usedAt display from ProxiesPage"
```

---

## Task 7: Verify Removal and Test

**Files:**
- No new files

**Step 1: Search for remaining usageCount references**

Run: `grep -r "usageCount" --include="*.ts" --include="*.vue" --include="*.js" .`

Expected: No results (except in this plan file and docs)

**Step 2: Search for remaining usedAt references**

Run: `grep -r "usedAt" --include="*.ts" --include="*.vue" --include="*.js" .`

Expected: No results (except in this plan file and docs)

**Step 3: Build the project**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors

**Step 4: Run database migration**

Run: `npm run prisma:migrate`

Expected: Migration applies successfully

**Step 5: Start application and verify**

Run: `npm run dev`

Test: Open the UI, navigate to Proxies page, verify no errors

**Step 6: Commit verification**

```bash
git add docs/plans/2026-02-06-remove-proxy-usage-tracking.md
git commit -m "docs: add implementation plan for removing proxy usage tracking"
```

---

## Task 8: Integration Test (Manual)

**Files:**
- No new files

**Step 1: Test proxy assignment with various counts**

Import 80 proxies → verify 40 workers created with 2 proxies each
Import 120 proxies → verify 40 workers created with 3 proxies each
Import 8 proxies → verify 4 workers created with 2 proxies each

**Step 2: Test credential checking flow**

Run credential check with proxies → verify no errors, rotation works

**Step 3: Commit final cleanup**

```bash
git add .
git commit -m "chore: final cleanup after removing proxy usage tracking"
```
