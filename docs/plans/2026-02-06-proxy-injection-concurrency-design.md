# Proxy Injection Concurrency Model - Design Document

**Date:** 2026-02-06
**Status:** Approved
**Risk Level:** Medium

## Overview

Replace the current "pull" model where workers call `proxyRepository.rotate()` with a "push" model that assigns proxies to workers at startup. Each worker receives two proxies upfront and round-robins between them.

## Problem Statement

**Current Architecture:**
- 40 workers compete for the same `rotate()` database function
- Each worker calls `rotate()` on every credential verification
- Database contention from concurrent `UPDATE` queries
- Workers wait for proxy rotation instead of working immediately

**Pain Points:**
- Slow verification due to database lock contention
- Unpredictable proxy distribution
- No mechanism to terminate workers when proxies die

## Solution

Assign proxies to workers before they start. Each worker gets two proxies, round-robins between them, and terminates when both proxies die.

**New Flow:**
```
1. Runner validates 40+ proxies exist
2. Runner assigns 2 proxies per worker (80 proxies → 40 workers)
3. Workers start with assigned proxies
4. Workers round-robin between their 2 proxies
5. Worker terminates when both proxies die
```

## Data Structures

```typescript
// Worker proxy assignment
interface WorkerProxyAssignment {
  proxy1: Proxy | null;
  proxy2: Proxy | null;
  currentIndex: 0 | 1;  // Which proxy to use next
}

// Worker context passed to verify
interface WorkerContext {
  workerId: string;
  proxyAssignment: WorkerProxyAssignment;
}
```

## Implementation Changes

### 1. IProxyRepository Interface

Add new methods:

```typescript
interface IProxyRepository {
  // Existing methods (keep for backward compatibility)
  rotate(): Promise<Proxy | null>;

  // New methods
  assignToWorkers(workerCount: number, proxiesPerWorker: number): Promise<Map<string, WorkerProxyAssignment>>;
  markProxyDead(proxyId: number): Promise<void>;
  getActiveCount(): Promise<number>;
}
```

### 2. CredentialCheckRunner.start()

Add validation and assignment:

```typescript
async start(): Promise<void> {
  // Validate minimum proxy count
  const activeProxyCount = await this.proxyRepository.getActiveCount();
  if (activeProxyCount < this.concurrency) {
    throw new Error(
      `Insufficient proxies: ${activeProxyCount} available, ` +
      `${this.concurrency} required`
    );
  }

  // Assign proxies to workers
  this.workerProxyAssignments = await this.proxyRepository.assignToWorkers(
    this.concurrency,
    2
  );

  // Start workers with assigned proxies
  this.run();
}
```

### 3. PlaywrightVerify.verify()

Accept `WorkerContext` and implement round-robin:

```typescript
async verify(credential: Credential, context: WorkerContext): Promise<boolean> {
  const assignment = context.proxyAssignment;

  // Select current proxy based on index
  const proxy = assignment.currentIndex === 0
    ? assignment.proxy1
    : assignment.proxy2;

  if (!proxy) {
    throw new Error('No proxy available');
  }

  // Launch browser with assigned proxy
  const browser = await chromium.launch({
    proxy: { server: proxy.server, username: proxy.username, password: proxy.password }
  });

  try {
    // ... verification logic ...
    return isVerified;
  } catch (e) {
    // Mark proxy as dead on error
    await this.proxyRepository.markProxyDead(proxy.id);
    return false;
  } finally {
    await browser.close();

    // Round-robin to next proxy
    if (assignment.proxy1 && assignment.proxy2) {
      assignment.currentIndex = assignment.currentIndex === 0 ? 1 : 0;
    }
  }
}
```

### 4. PrismaProxyRepository.assignToWorkers()

```typescript
async assignToWorkers(
  workerCount: number,
  proxiesPerWorker: number
): Promise<Map<string, WorkerProxyAssignment>> {
  return await prisma.$transaction(async (tx) => {
    const proxies = await tx.$queryRaw<ProxyRow[]>`
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

      assignments.set(`worker-${i + 1}`, {
        proxy1,
        proxy2,
        currentIndex: 0
      });

      if (proxy1) await this.markInUse(tx, proxy1.id);
      if (proxy2) await this.markInUse(tx, proxy2.id);
    }

    return assignments;
  });
}
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| < 40 proxies | Throw error, prevent startup |
| 40 proxies | 40 workers, 1 proxy each |
| 80 proxies | 40 workers, 2 proxies each |
| 81 proxies | 40 workers (35 get 2, 5 get 1), 1 unused |
| Proxy dies during launch | Mark dead, switch to second proxy |
| Both proxies die | Worker terminates |
| Worker crash | Proxies remain active for reassignment |

## Status Tracking

Enhance `CheckStatus` with proxy health:

```typescript
interface CheckStatus {
  // ... existing fields ...

  // New fields
  totalProxies: number;
  activeProxies: number;
  deadProxies: number;
  workersWithDeadProxies: number;
}
```

## Testing

### Unit Tests
- `assignToWorkers()` with 40, 80, 45 proxies
- Round-robin logic alternates `currentIndex`
- `markProxyDead()` sets status correctly

### Integration Tests
- Start runner with 80 proxies → verify 40 workers spawn
- Kill proxies → verify workers terminate
- Status reporting updates in real-time

### Manual Testing
```bash
# Test minimum validation
# Add 39 proxies → expect error

# Test normal operation
# Add 80 proxies → start → verify logs

# Test proxy death
# Kill proxies → verify workers terminate
```

## Benefits

1. **Performance:** No database contention from 40 concurrent `rotate()` calls
2. **Predictability:** Workers know their proxies upfront
3. **Resilience:** Workers terminate naturally when proxies die
4. **Observability:** Enhanced status tracking shows proxy health

## Files to Modify

| File | Changes |
|------|---------|
| `core/repositories/IProxyRepository.ts` | Add new interface methods |
| `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts` | Implement new methods |
| `application/services/CredentialCheckRunner.ts` | Add assignment logic, validation |
| `infrastructure/verifier/PlaywrightVerify.ts` | Accept context, round-robin |
| `application/use-cases/ScanCredentialsUseCase.ts` | Pass workerContext |
| `application/ports/IVerifyService.ts` | Update verify signature |
