# Proxy Injection Concurrency Model - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the pull-based proxy rotation model with a push-based assignment model where each worker receives 2 proxies upfront and round-robins between them.

**Architecture:** Modify the credential check runner to assign proxies to workers before they start. Each worker maintains its own proxy assignment and rotates between them internally. Workers terminate when both assigned proxies die.

**Tech Stack:** TypeScript, Awilix DI, Prisma ORM, Playwright/Patchright

---

## Task 1: Add New Data Structures

**Files:**
- Create: `core/value-objects/WorkerProxyAssignment.ts`
- Create: `core/value-objects/WorkerContext.ts`

**Step 1: Write WorkerProxyAssignment value object**

Create `core/value-objects/WorkerProxyAssignment.ts`:

```typescript
import { Proxy } from "../entities/Proxy";

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

export function getNextProxy(assignment: WorkerProxyAssignment): Proxy | null {
  return assignment.currentIndex === 0 ? assignment.proxy1 : assignment.proxy2;
}

export function rotateProxyIndex(assignment: WorkerProxyAssignment): void {
  if (assignment.proxy1 && assignment.proxy2) {
    assignment.currentIndex = assignment.currentIndex === 0 ? 1 : 0;
  }
}

export function hasAliveProxy(assignment: WorkerProxyAssignment): boolean {
  return (assignment.proxy1?.status === 'ACTIVE') ||
         (assignment.proxy2?.status === 'ACTIVE');
}
```

**Step 2: Write WorkerContext value object**

Create `core/value-objects/WorkerContext.ts`:

```typescript
import { WorkerProxyAssignment } from "./WorkerProxyAssignment";

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

**Step 3: Export from index**

Create `core/value-objects/index.ts` (if not exists) or add exports:

```typescript
export * from "./WorkerProxyAssignment";
export * from "./WorkerContext";
```

**Step 4: Commit**

```bash
git add core/value-objects/WorkerProxyAssignment.ts core/value-objects/WorkerContext.ts core/value-objects/index.ts
git commit -m "feat: add WorkerProxyAssignment and WorkerContext value objects"
```

---

## Task 2: Update IProxyRepository Interface

**Files:**
- Modify: `core/repositories/IProxyRepository.ts`

**Step 1: Add new interface methods**

Modify `core/repositories/IProxyRepository.ts` - add these methods after `rotate()`:

```typescript
export default interface IProxyRepository {
  list(): Promise<Proxy[]>;
  findById(id: number): Promise<Proxy | null>;
  findByServer(server: string): Promise<Proxy | null>;
  create(data: CreateProxyData): Promise<Proxy>;
  update(id: number, data: UpdateProxyData): Promise<Proxy>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<number>;
  rotate(): Promise<Proxy | null>;

  // New methods for proxy injection model
  assignToWorkers(workerCount: number, proxiesPerWorker: number): Promise<Map<string, import("../value-objects/WorkerProxyAssignment").WorkerProxyAssignment>>;
  markProxyDead(proxyId: number): Promise<void>;
  getActiveCount(): Promise<number>;
  getTotalCount(): Promise<number>;
}
```

**Step 2: Commit**

```bash
git add core/repositories/IProxyRepository.ts
git commit -m "feat: add proxy assignment methods to IProxyRepository"
```

---

## Task 3: Implement New Repository Methods

**Files:**
- Modify: `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts`

**Step 1: Add getActiveCount method**

Add to `PrismaProxyRepository` class:

```typescript
async getActiveCount(): Promise<number> {
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM "Proxy"
    WHERE status = 'ACTIVE'
  `;
  return Number(result[0].count);
}
```

**Step 2: Add getTotalCount method**

Add to `PrismaProxyRepository` class:

```typescript
async getTotalCount(): Promise<number> {
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM "Proxy"
  `;
  return Number(result[0].count);
}
```

**Step 3: Add markProxyDead method**

Add to `PrismaProxyRepository` class:

```typescript
async markProxyDead(proxyId: number): Promise<void> {
  await prisma.proxy.update({
    where: { id: proxyId },
    data: {
      status: 'DEAD',
      updatedAt: new Date()
    }
  });
}
```

**Step 4: Add markInUse private helper**

Add to `PrismaProxyRepository` class (private method):

```typescript
private async markInUse(tx: any, proxyId: number): Promise<void> {
  await tx.proxy.update({
    where: { id: proxyId },
    data: {
      usedAt: new Date(),
      usageCount: { increment: 1 },
      updatedAt: new Date()
    }
  });
}
```

**Step 5: Add assignToWorkers method**

Add to `PrismaProxyRepository` class:

```typescript
async assignToWorkers(
  workerCount: number,
  proxiesPerWorker: number
): Promise<Map<string, import("../../../../core/value-objects/WorkerProxyAssignment").WorkerProxyAssignment>> {
  const WorkerProxyAssignment = (await import('../../../../core/value-objects/WorkerProxyAssignment')).createWorkerProxyAssignment;

  return await prisma.$transaction(async (tx) => {
    const proxies = await tx.$queryRaw<any[]>`
      SELECT * FROM "Proxy"
      WHERE status = 'ACTIVE'
      ORDER BY "usedAt" ASC
      LIMIT ${workerCount * proxiesPerWorker}
      FOR UPDATE SKIP LOCKED
    `;

    const assignments = new Map<string, import("../../../../core/value-objects/WorkerProxyAssignment").WorkerProxyAssignment>();

    for (let i = 0; i < workerCount; i++) {
      const proxy1 = proxies[i * 2] ? this.toEntity(proxies[i * 2]) : null;
      const proxy2 = proxies[i * 2 + 1] ? this.toEntity(proxies[i * 2 + 1]) : null;

      assignments.set(`worker-${i + 1}`, WorkerProxyAssignment(proxy1, proxy2));

      if (proxy1) await this.markInUse(tx, proxy1.id);
      if (proxy2) await this.markInUse(tx, proxy2.id);
    }

    return assignments;
  });
}
```

**Step 6: Commit**

```bash
git add infrastructure/db/prisma/repositories/PrismaProxyRepository.ts
git commit -m "feat: implement proxy assignment methods in PrismaProxyRepository"
```

---

## Task 4: Update IVerifyService Interface

**Files:**
- Modify: `application/ports/IVerifyService.ts`

**Step 1: Update verify signature**

Modify `application/ports/IVerifyService.ts`:

```typescript
import { Credential } from "../../core/entities/Credential";
import { WorkerContext } from "../../core/value-objects/WorkerContext";

export default interface IVerifyService {
  verify(credential: Credential, context: WorkerContext): Promise<boolean>;
}
```

**Step 2: Commit**

```bash
git add application/ports/IVerifyService.ts
git commit -m "feat: update IVerifyService.verify to accept WorkerContext"
```

---

## Task 5: Update ScanCredentialsUseCase

**Files:**
- Modify: `application/use-cases/ScanCredentialsUseCase.ts`

**Step 1: Update config interface**

Modify the `ScanCredentialsConfig` interface in `ScanCredentialsUseCase.ts`:

```typescript
import { WorkerContext } from "../../core/value-objects/WorkerContext";

export interface ScanCredentialsConfig {
  batchSize: number;
  workerId: string;
  workerContext: WorkerContext;
}
```

**Step 2: Update execute method to pass context**

Find the line that calls `this.verifyService.verify()` and update it:

```typescript
// Inside execute() method, find the verify call and update:
const isValid = await this.verifyService.verify(
  credential,
  this.config.workerContext  // Add this parameter
);
```

**Step 3: Commit**

```bash
git add application/use-cases/ScanCredentialsUseCase.ts
git commit -m "feat: pass WorkerContext through ScanCredentialsUseCase"
```

---

## Task 6: Update CredentialCheckRunner

**Files:**
- Modify: `application/services/CredentialCheckRunner.ts`

**Step 1: Add imports and state**

Add at top of file:

```typescript
import { WorkerContext, createWorkerContext } from "../../core/value-objects/WorkerContext";
import { hasAliveProxy } from "../../core/value-objects/WorkerProxyAssignment";
```

Add to class properties:

```typescript
private workerProxyAssignments: Map<string, import("../../core/value-objects/WorkerProxyAssignment").WorkerProxyAssignment> = new Map();
```

**Step 2: Update CheckStatus interface**

Add to `CheckStatus` interface:

```typescript
export interface CheckStatus {
  isRunning: boolean;
  total: number;
  processed: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError?: string | null;
  concurrency: number;
  activeWorkers: number;
  totalProxies: number;
  activeProxies: number;
  deadProxies: number;
  workersWithDeadProxies: number;
}
```

**Step 3: Update start() method with validation**

Replace the existing `start()` method's beginning:

```typescript
async start(): Promise<void> {
  if (this.isRunning) {
    return;
  }

  const isDebug = process.env.AUTOMATE_DEBUG === 'true';
  this.concurrency = isDebug ? 1 : 40;

  // NEW: Validate minimum proxy count
  const activeProxyCount = await this.credentialRepository.getActiveCount();
  const requiredProxies = this.concurrency;

  if (activeProxyCount < requiredProxies) {
    throw new Error(
      `Insufficient proxies: ${activeProxyCount} available, ` +
      `${requiredProxies} required (minimum: ${this.concurrency})`
    );
  }

  this.isRunning = true;
  this.status = {
    isRunning: true,
    total: 0,
    processed: 0,
    startedAt: new Date(),
    finishedAt: null,
    lastError: null,
    concurrency: this.concurrency,
    activeWorkers: 0,
    totalProxies: 0,
    activeProxies: 0,
    deadProxies: 0,
    workersWithDeadProxies: 0,
  };

  // Start stale claim cleanup task
  this.startStaleClaimCleanup();

  // Start parallel workers
  this.run().catch((err) => {
    this.status.lastError = err?.message ?? 'Unknown error';
    this.isRunning = false;
    this.status.isRunning = false;
    this.status.finishedAt = new Date();
  });
}
```

**Step 4: Update run() method to assign proxies**

Modify the `run()` method:

```typescript
private async run(): Promise<void> {
  // NEW: Assign proxies to workers before starting
  this.workerProxyAssignments = await this.credentialRepository.assignToWorkers(
    this.concurrency,
    2
  );

  console.log(`Assigned ${this.workerProxyAssignments.size} workers with proxy assignments`);

  // Create an array of worker promises
  const workers: Promise<void>[] = [];

  for (let i = 0; i < this.concurrency; i++) {
    const workerId = `worker-${i + 1}`;
    workers.push(this.runWorker(workerId));
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  this.isRunning = false;
  this.status.isRunning = false;
  this.status.finishedAt = new Date();
}
```

**Step 5: Update runWorker() method with context**

Replace the existing `runWorker()` method:

```typescript
private async runWorker(workerId: string): Promise<void> {
  const assignment = this.workerProxyAssignments.get(workerId);

  if (!assignment || (!assignment.proxy1 && !assignment.proxy2)) {
    console.error(`${workerId}: No proxy assignment, skipping`);
    return;
  }

  const workerContext = createWorkerContext(workerId, assignment);
  console.log(`Starting ${workerId} with proxies:`, {
    proxy1: assignment.proxy1?.server || 'none',
    proxy2: assignment.proxy2?.server || 'none'
  });

  this.activeWorkers++;

  try {
    while (this.isRunning) {
      const action = new ScanCredentialsUseCase(
        this.credentialRepository,
        this.verifyService,
        this.uiNotifier,
        {
          batchSize: this.batchSize,
          workerId,
          workerContext
        }
      );

      const processedCount = await action.execute();
      this.status.processed += processedCount;

      // Check if worker should exit (both proxies dead)
      if (!hasAliveProxy(assignment)) {
        console.log(`${workerId}: All assigned proxies dead, terminating`);
        break;
      }

      // If no credentials were processed, wait before trying again
      if (processedCount === 0) {
        await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs));
      }
    }
  } catch (error) {
    console.error(`Error in ${workerId}:`, error);
    this.status.lastError = `${workerId}: ${error?.message ?? 'Unknown error'}`;
  } finally {
    this.activeWorkers--;
    console.log(`Stopped ${workerId}`);
  }
}
```

**Step 6: Update getStatus() method**

Replace the `getStatus()` method:

```typescript
getStatus(): CheckStatus {
  const proxyStats = this.getProxyStats();

  return {
    ...this.status,
    activeWorkers: this.activeWorkers,
    ...proxyStats
  };
}

private getProxyStats(): Omit<CheckStatus, 'isRunning' | 'total' | 'processed' | 'startedAt' | 'finishedAt' | 'lastError' | 'concurrency' | 'activeWorkers'> {
  // Calculate from assignments
  let workersWithAliveProxies = 0;
  let totalProxies = 0;
  let activeProxies = 0;

  for (const [, assignment] of this.workerProxyAssignments) {
    if (hasAliveProxy(assignment)) {
      workersWithAliveProxies++;
    }
    if (assignment.proxy1) {
      totalProxies++;
      if (assignment.proxy1.status === 'ACTIVE') activeProxies++;
    }
    if (assignment.proxy2) {
      totalProxies++;
      if (assignment.proxy2.status === 'ACTIVE') activeProxies++;
    }
  }

  return {
    totalProxies,
    activeProxies,
    deadProxies: totalProxies - activeProxies,
    workersWithDeadProxies: this.concurrency - workersWithAliveProxies
  };
}
```

**Step 7: Fix credentialRepository type error**

Note: `CredentialCheckRunner` uses `ICredentialRepository` but we're calling proxy methods. We need to inject `IProxyRepository` instead.

Update constructor:

```typescript
constructor(
  private readonly credentialRepository: ICredentialRepository,
  private readonly verifyService: IVerifyService,
  private readonly uiNotifier: IUiNotifier,
  private readonly settingService: SettingService,
  private readonly proxyRepository: IProxyRepository,  // NEW
  config?: CredentialCheckRunnerConfig
) {
  // ... existing code ...
}
```

**Step 8: Update container.ts registration**

Add `proxyRepository` to `CredentialCheckRunner` registration in `container.ts`:

Find the CredentialCheckRunner registration and update:

```typescript
container.register('CredentialCheckRunner', {
  lifecycle: Lifecycle.Singleton,
  resolver: (c) => new CredentialCheckRunner(
    c.resolve('ICredentialRepository'),
    c.resolve('IVerifyService'),
    c.resolve('IUiNotifier'),
    c.resolve('SettingService'),
    c.resolve('IProxyRepository'),  // Add this
    {
      concurrency: parseInt(process.env.CREDENTIAL_CHECK_CONCURRENCY || '10'),
      batchSize: parseInt(process.env.CREDENTIAL_CHECK_BATCH_SIZE || '3'),
      pollingIntervalMs: parseInt(process.env.CREDENTIAL_CHECK_POLLING_INTERVAL_MS || '1000'),
      staleClaimTimeoutMinutes: parseInt(process.env.CREDENTIAL_CHECK_STALE_TIMEOUT_MINUTES || '10'),
    }
  )
});
```

**Step 9: Commit**

```bash
git add application/services/CredentialCheckRunner.ts container.ts
git commit -m "feat: implement proxy assignment in CredentialCheckRunner"
```

---

## Task 7: Update PlaywrightVerify

**Files:**
- Modify: `infrastructure/verifier/PlaywrightVerify.ts`

**Step 1: Add imports**

Add at top of file:

```typescript
import { WorkerContext } from "../../core/value-objects/WorkerContext";
import { getNextProxy, rotateProxyIndex } from "../../core/value-objects/WorkerProxyAssignment";
```

**Step 2: Update verify method signature**

Update the `verify` method:

```typescript
async verify(credential: Credential, context: WorkerContext): Promise<boolean> {
  if (credential.password.length < 8) {
    return false;
  }

  const assignment = context.proxyAssignment;

  // Get current proxy based on round-robin index
  const proxy = getNextProxy(assignment);

  if (!proxy) {
    console.error(`${context.workerId}: No proxy available`);
    return false;
  }

  console.log(`${context.workerId}: Using proxy ${proxy.server} (index: ${assignment.currentIndex})`);

  const isDebug = process.env.AUTOMATE_DEBUG === 'true';

  const userAgentData = new UserAgent({
    deviceCategory: 'mobile',
    platform: 'iPhone'
  });

  // REMOVE: const proxy = await this.proxyRepository.rotate();

  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--hide-scrollbars',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--disable-gpu-shader-disk-cache',
    ],
    proxy: proxy ? {
      server: proxy.server,
      username: proxy.username ?? void 0,
      password: proxy.password ?? void 0
    } : void 0
  });

  const context_obj = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
    timezoneId: "Asia/Bangkok",
  });

  const page = await context_obj.newPage();

  // ... keep existing GPU spoofing, CDP session, etc ...

  try {
    // ... keep existing verification flow ...

    return isVerified;
  } catch (e) {
    console.error(`${context.workerId}: Verification error:`, e);

    // NEW: Mark current proxy as dead on error
    if (proxy) {
      await this.proxyRepository.markProxyDead(proxy.id);
      console.log(`${context.workerId}: Marked proxy ${proxy.server} as DEAD`);
    }

    return false;
  } finally {
    await context_obj.close();
    await browser.close();

    // NEW: Round-robin to next proxy for next call
    rotateProxyIndex(assignment);
  }
}
```

**Step 3: Commit**

```bash
git add infrastructure/verifier/PlaywrightVerify.ts
git commit -m "feat: implement round-robin proxy logic in PlaywrightVerify"
```

---

## Task 8: Manual Testing

**Files:** None

**Step 1: Build the project**

```bash
npm run build
```

**Step 2: Test minimum proxy validation**

Start with fewer than 40 proxies:

```bash
# In the UI, add only 39 proxies
# Start credential check
# Expected: Error message "Insufficient proxies: 39 available, 40 required"
```

**Step 3: Test normal operation**

Add 80 proxies and start:

```bash
# Add 80 proxies
# Start credential check
# Check logs for: "Assigned 40 workers with proxy assignments"
# Verify 40 workers start
```

**Step 4: Test proxy death**

```bash
# Kill some proxy connections while running
# Verify workers terminate as proxies die
# Check status: workersWithDeadProxies increases
```

**Step 5: Verify round-robin**

```bash
# Monitor proxy usageCount in database
# All proxies should have similar counts (even distribution)
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `core/value-objects/WorkerProxyAssignment.ts` | NEW - Proxy assignment for workers |
| `core/value-objects/WorkerContext.ts` | NEW - Worker context with proxy assignment |
| `core/repositories/IProxyRepository.ts` | Add assignToWorkers, markProxyDead, getActiveCount, getTotalCount |
| `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts` | Implement new methods |
| `application/ports/IVerifyService.ts` | Update verify signature to accept WorkerContext |
| `application/use-cases/ScanCredentialsUseCase.ts` | Pass WorkerContext to verify service |
| `application/services/CredentialCheckRunner.ts` | Add assignment logic, validation, status tracking |
| `container.ts` | Inject IProxyRepository into CredentialCheckRunner |
| `infrastructure/verifier/PlaywrightVerify.ts` | Implement round-robin, mark dead proxies |
