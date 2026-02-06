# Proxy Injection Concurrency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace pull model (workers calling `rotate()`) with push model (assign 2 proxies per worker at startup)

**Architecture:** Pre-assign proxies to workers in CredentialCheckRunner.start(), pass WorkerContext through verification chain, implement round-robin proxy rotation in PlaywrightVerify.

**Tech Stack:** TypeScript, Prisma ORM, Awilix DI, Playwright/Patchright

---

## Task 1: Add Value Objects (WorkerProxyAssignment, WorkerContext)

**Files:**
- Create: `core/value-objects/WorkerProxyAssignment.ts`
- Create: `core/value-objects/WorkerContext.ts`

**Step 1: Create WorkerProxyAssignment value object**

```typescript
// core/value-objects/WorkerProxyAssignment.ts
import { Proxy } from '../entities/Proxy';

export interface WorkerProxyAssignment {
  proxy1: Proxy | null;
  proxy2: Proxy | null;
  currentIndex: 0 | 1;
}

export function createWorkerProxyAssignment(
  proxy1: Proxy | null,
  proxy2: Proxy | null
): WorkerProxyAssignment {
  return {
    proxy1,
    proxy2,
    currentIndex: 0
  };
}
```

**Step 2: Create WorkerContext value object**

```typescript
// core/value-objects/WorkerContext.ts
import { WorkerProxyAssignment } from './WorkerProxyAssignment';

export interface WorkerContext {
  workerId: string;
  proxyAssignment: WorkerProxyAssignment;
}

export function createWorkerContext(
  workerId: string,
  proxyAssignment: WorkerProxyAssignment
): WorkerContext {
  return {
    workerId,
    proxyAssignment
  };
}
```

**Step 3: Commit**

```bash
git add core/value-objects/WorkerProxyAssignment.ts core/value-objects/WorkerContext.ts
git commit -m "feat: add WorkerProxyAssignment and WorkerContext value objects"
```

---

## Task 2: Extend IProxyRepository Interface

**Files:**
- Modify: `core/repositories/IProxyRepository.ts`

**Step 1: Add new methods to interface**

Read existing file first to see current structure.

```typescript
// Add these methods to IProxyRepository interface
  assignToWorkers(workerCount: number, proxiesPerWorker: number): Promise<Map<string, import('../value-objects/WorkerProxyAssignment').WorkerProxyAssignment>>;
  markProxyDead(proxyId: number): Promise<void>;
  getActiveCount(): Promise<number>;
```

**Step 2: Commit**

```bash
git add core/repositories/IProxyRepository.ts
git commit -m "feat: add proxy assignment methods to IProxyRepository"
```

---

## Task 3: Implement New Methods in PrismaProxyRepository

**Files:**
- Modify: `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts`

**Step 1: Implement getActiveCount()**

```typescript
async getActiveCount(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "Proxy"
    WHERE status = 'ACTIVE'
  `;
  return Number(result[0].count);
}
```

**Step 2: Implement markProxyDead()**

```typescript
async markProxyDead(proxyId: number): Promise<void> {
  await prisma.proxy.update({
    where: { id: proxyId },
    data: { status: 'DEAD' }
  });
}
```

**Step 3: Implement assignToWorkers()**

```typescript
import { WorkerProxyAssignment, createWorkerProxyAssignment } from '../../../../core/value-objects/WorkerProxyAssignment';
import { Proxy } from '../../../../core/entities/Proxy';

async assignToWorkers(
  workerCount: number,
  proxiesPerWorker: number
): Promise<Map<string, WorkerProxyAssignment>> {
  return await prisma.$transaction(async (tx) => {
    const proxies = await tx.$queryRaw<any[]>`
      SELECT * FROM "Proxy"
      WHERE status = 'ACTIVE'
      ORDER BY "usedAt" ASC
      LIMIT ${workerCount * proxiesPerWorker}
      FOR UPDATE SKIP LOCKED
    `;

    const assignments = new Map<string, WorkerProxyAssignment>();

    for (let i = 0; i < workerCount; i++) {
      const proxy1 = proxies[i * 2] ? this.toEntity(proxies[i * 2]) : null;
      const proxy2 = proxies[i * 2 + 1] ? this.toEntity(proxies[i * 2 + 1]) : null;

      assignments.set(`worker-${i + 1}`, createWorkerProxyAssignment(proxy1, proxy2));

      // Mark proxies as in-use
      if (proxy1) {
        await tx.proxy.update({
          where: { id: proxy1.id },
          data: { status: 'IN_USE' }
        });
      }
      if (proxy2) {
        await tx.proxy.update({
          where: { id: proxy2.id },
          data: { status: 'IN_USE' }
        });
      }
    }

    return assignments;
  });
}
```

**Step 4: Commit**

```bash
git add infrastructure/db/prisma/repositories/PrismaProxyRepository.ts
git commit -m "feat: add proxy assignment methods in PrismaProxyRepository"
```

---

## Task 4: Update IVerifyService Interface

**Files:**
- Modify: `application/ports/IVerifyService.ts`

**Step 1: Modify verify signature to accept WorkerContext**

```typescript
// Change from:
// verify(credential: Credential): Promise<boolean>;

// To:
import { WorkerContext } from '../../core/value-objects/WorkerContext';

verify(credential: Credential, context: WorkerContext): Promise<boolean>;
```

**Step 2: Commit**

```bash
git add application/ports/IVerifyService.ts
git commit -m "feat: update IVerifyService.verify to accept WorkerContext"
```

---

## Task 5: Update PlaywrightVerify to Use WorkerContext

**Files:**
- Modify: `infrastructure/verifier/PlaywrightVerify.ts`

**Step 1: Import WorkerContext and update method signature**

```typescript
import { WorkerContext } from '../../core/value-objects/WorkerContext';

// Update the verify method:
async verify(credential: Credential, context: WorkerContext): Promise<boolean> {
```

**Step 2: Implement round-robin proxy selection**

```typescript
async verify(credential: Credential, context: WorkerContext): Promise<boolean> {
  const assignment = context.proxyAssignment;

  // Select current proxy based on index
  const proxy = assignment.currentIndex === 0
    ? assignment.proxy1
    : assignment.proxy2;

  if (!proxy) {
    throw new Error(`Worker ${context.workerId}: No proxy available`);
  }

  const browser = await chromium.launch({
    proxy: {
      server: proxy.server,
      username: proxy.username || undefined,
      password: proxy.password || undefined
    }
  });

  try {
    // ... existing verification logic ...
    // const isVerified = await this.doVerification(...);
    // return isVerified;
    return true; // placeholder
  } catch (e) {
    // Mark proxy as dead on error
    await this.proxyRepository.markProxyDead(proxy.id);
    return false;
  } finally {
    await browser.close();

    // Round-robin to next proxy if both are available
    if (assignment.proxy1 && assignment.proxy2) {
      assignment.currentIndex = assignment.currentIndex === 0 ? 1 : 0;
    }
  }
}
```

**Step 3: Commit**

```bash
git add infrastructure/verifier/PlaywrightVerify.ts
git commit -m "feat: implement round-robin proxy selection in PlaywrightVerify"
```

---

## Task 6: Update ScanCredentialsUseCase to Pass WorkerContext

**Files:**
- Modify: `application/use-cases/ScanCredentialsUseCase.ts`

**Step 1: Modify to create and pass WorkerContext**

```typescript
import { createWorkerContext } from '../../core/value-objects/WorkerContext';

// In the method that processes credentials, update:
// Before (example):
// const isValid = await this.verifyService.verify(credential);

// After:
const workerContext = createWorkerContext(
  `worker-${workerIndex}`,
  proxyAssignment
);
const isValid = await this.verifyService.verify(credential, workerContext);
```

**Step 2: Commit**

```bash
git add application/use-cases/ScanCredentialsUseCase.ts
git commit -m "feat: pass WorkerContext to verify service in ScanCredentialsUseCase"
```

---

## Task 7: Update CredentialCheckRunner to Assign Proxies

**Files:**
- Modify: `application/services/CredentialCheckRunner.ts`

**Step 1: Add workerProxyAssignments property**

```typescript
import { WorkerProxyAssignment } from '../../core/value-objects/WorkerProxyAssignment';

export class CredentialCheckRunner {
  // ... existing properties ...

  private workerProxyAssignments: Map<string, WorkerProxyAssignment> = new Map();
```

**Step 2: Update start() method with validation and assignment**

```typescript
async start(): Promise<void> {
  // Validate minimum proxy count
  const activeProxyCount = await this.proxyRepository.getActiveCount();
  const requiredProxies = Math.ceil(this.concurrency * 2);

  if (activeProxyCount < this.concurrency) {
    throw new Error(
      `Insufficient proxies: ${activeProxyCount} available, ` +
      `${this.concurrency} required (minimum 1 per worker)`
    );
  }

  // Assign proxies to workers
  this.workerProxyAssignments = await this.proxyRepository.assignToWorkers(
    this.concurrency,
    2
  );

  this.logger.info(
    `Assigned ${this.workerProxyAssignments.size} workers with ` +
    `${Array.from(this.workerProxyAssignments.values()).filter(a => a.proxy1).length} primary proxies`
  );

  // Start workers with assigned proxies
  this.run();
}
```

**Step 3: Pass assignments to workers in run() method**

Update the worker spawning logic to include proxy assignments. This will depend on your current worker implementation pattern.

**Step 4: Commit**

```bash
git add application/services/CredentialCheckRunner.ts
git commit -m "feat: add proxy assignment and validation in CredentialCheckRunner.start"
```

---

## Task 8: Update CheckStatus with Proxy Health Metrics

**Files:**
- Modify: Find and update the CheckStatus interface (likely in `core/value-objects/` or `core/entities/`)

**Step 1: Add proxy health fields**

```typescript
// Add to CheckStatus interface:
interface CheckStatus {
  // ... existing fields ...

  // New fields
  totalProxies: number;
  activeProxies: number;
  deadProxies: number;
  workersWithDeadProxies: number;
}
```

**Step 2: Commit**

```bash
git add <path-to-CheckStatus-file>
git commit -m "feat: add proxy health metrics to CheckStatus"
```

---

## Task 9: Update Container Registration

**Files:**
- Modify: `container.ts`

**Step 1: Verify all dependencies are registered**

Ensure the container properly resolves all updated dependencies. No changes likely needed if using Awilix's auto-registration, but verify imports are correct.

**Step 2: Build to check for errors**

```bash
npm run build:backend
```

**Step 3: Fix any import/type errors**

**Step 4: Commit if changes made**

```bash
git add container.ts
git commit -m "fix: update container imports for new value objects"
```

---

## Task 10: Integration Testing

**Files:**
- Create: `tests/integration/proxy-assignment.test.ts` (if tests exist)

**Step 1: Test minimum proxy validation**

```typescript
// Test that runner throws with < 40 proxies
// 1. Add only 39 proxies to DB
// 2. Try to start runner with concurrency=40
// 3. Expect error: "Insufficient proxies"
```

**Step 2: Test proxy assignment**

```typescript
// Test with 80 proxies, concurrency=40
// 1. Add 80 proxies
// 2. Start runner
// 3. Verify 40 workers created
// 4. Verify each worker has 2 proxies
```

**Step 3: Test round-robin**

```typescript
// Test that currentIndex alternates
// 1. Mock verify to track proxy usage
// 2. Run 2 verifications
// 3. Verify currentIndex changed from 0 to 1
```

**Step 4: Test proxy death marking**

```typescript
// Test that failed verification marks proxy dead
// 1. Mock verify to throw error
// 2. Run verification
// 3. Check proxy status = 'DEAD'
```

**Step 5: Commit tests**

```bash
git add tests/integration/proxy-assignment.test.ts
git commit -m "test: add proxy assignment integration tests"
```

---

## Task 11: Manual Verification

**Step 1: Build the project**

```bash
npm run build
```

**Step 2: Test with minimum proxies**

```sql
-- In SQLite:
DELETE FROM Proxy;
-- Add 39 proxies
-- Try to start application
-- Expected: Error message "Insufficient proxies"
```

**Step 3: Test with 80 proxies**

```sql
-- Add 80 ACTIVE proxies
-- Start application
-- Check logs: "Assigned 40 workers with 80 primary proxies"
-- Verify workers process credentials
```

**Step 4: Test proxy death**

```sql
-- Kill a proxy being used
-- Verify worker switches to second proxy
-- Kill second proxy
-- Verify worker terminates
```

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: issues found during manual testing"
```

---

## Task 12: Update Documentation

**Files:**
- Modify: `README.md` or `docs/` as appropriate

**Step 1: Document new proxy requirement**

```markdown
## Proxy Requirements

- Minimum: CONCURRENCY proxies (e.g., 40 for default concurrency)
- Recommended: CONCURRENCY * 2 proxies for full round-robin
- Each worker gets 2 proxies at startup
- Workers round-robin between assigned proxies
- Workers terminate when both proxies die
```

**Step 2: Commit docs**

```bash
git add README.md
git commit -m "docs: update proxy requirements documentation"
```

---

## Final Verification

**Step 1: Run full build**

```bash
npm run build
npm run build:frontend
```

**Step 2: Run all tests**

```bash
npm test
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete proxy injection concurrency model implementation"
```
