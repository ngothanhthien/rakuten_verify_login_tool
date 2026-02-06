# Task 8: Integration Test (Manual) - Test Plan

## Implementation Summary

The new dynamic proxy assignment logic has been implemented in `/home/cnnt/self/rakuten/infrastructure/db/prisma/repositories/PrismaProxyRepository.ts`:

- **workerCount** = MIN(floor(totalProxies / 2), 40)
- **proxiesPerWorker** = 2 (fixed)

This is a **simplified model** where each worker gets exactly 2 proxies, and the number of workers is dynamically calculated based on available proxies.

---

## Test Plan 1: Proxy Assignment with Various Counts

### Test Case 1.1: 80 Proxies
**Setup:**
- Import 80 proxies with status='ACTIVE'

**Expected Behavior:**
- workerCount = MIN(floor(80 / 2), 40) = MIN(40, 40) = 40 workers
- Each worker gets 2 proxies
- Total proxies used: 40 * 2 = 80

**Verification:**
```sql
SELECT COUNT(*) FROM Proxy WHERE status = 'ACTIVE';
-- Should return 80 before test

-- After starting check runner:
-- Check console logs for: "Assigned 40 workers with 40 primary proxies"
-- Check database:
SELECT COUNT(*) FROM Proxy WHERE status = 'IN_USE';
-- Should return 80
```

**Console Output Expected:**
```
Assigned 40 workers with 40 primary proxies
Starting worker-1 with proxies: proxy1-server, proxy2-server
Starting worker-2 with proxies: proxy3-server, proxy4-server
...
```

---

### Test Case 1.2: 120 Proxies
**Setup:**
- Import 120 proxies with status='ACTIVE'

**Expected Behavior:**
- workerCount = MIN(floor(120 / 2), 40) = MIN(60, 40) = 40 workers
- Each worker gets 2 proxies
- Total proxies used: 40 * 2 = 80
- **40 proxies remain unused** (capped at max 40 workers)

**Verification:**
```sql
SELECT COUNT(*) FROM Proxy WHERE status = 'ACTIVE';
-- Should return 120 before test

-- After starting check runner:
SELECT COUNT(*) FROM Proxy WHERE status = 'IN_USE';
-- Should return 80 (40 workers * 2 proxies)
-- 40 proxies should still be ACTIVE (unused)
```

**Console Output Expected:**
```
Assigned 40 workers with 40 primary proxies
```

---

### Test Case 1.3: 8 Proxies
**Setup:**
- Import 8 proxies with status='ACTIVE'

**Expected Behavior:**
- workerCount = MIN(floor(8 / 2), 40) = MIN(4, 40) = 4 workers
- Each worker gets 2 proxies
- Total proxies used: 4 * 2 = 8

**Verification:**
```sql
SELECT COUNT(*) FROM Proxy WHERE status = 'ACTIVE';
-- Should return 8 before test

-- After starting check runner:
SELECT COUNT(*) FROM Proxy WHERE status = 'IN_USE';
-- Should return 8
```

**Console Output Expected:**
```
Assigned 4 workers with 4 primary proxies
Starting worker-1 with proxies: proxy1-server, proxy2-server
Starting worker-2 with proxies: proxy3-server, proxy4-server
Starting worker-3 with proxies: proxy5-server, proxy6-server
Starting worker-4 with proxies: proxy7-server, proxy8-server
```

---

### Test Case 1.4: Edge Case - 1 Proxy
**Setup:**
- Import 1 proxy with status='ACTIVE'

**Expected Behavior:**
- workerCount = MIN(floor(1 / 2), 40) = MIN(0, 40) = 0 workers
- No workers created
- Error thrown: "Insufficient proxies: 1 available, 1 required (minimum 1 per worker)"

**Verification:**
```sql
-- Application should throw error and not start
-- Console should show error message
```

---

### Test Case 1.5: Edge Case - 0 Proxies
**Setup:**
- Delete all proxies

**Expected Behavior:**
- workerCount = MIN(floor(0 / 2), 40) = 0 workers
- Error thrown

**Verification:**
```sql
-- Application should throw error and not start
```

---

## Test Plan 2: Credential Checking Flow

### Test Case 2.1: Basic Flow with Proxies
**Setup:**
- Import 80 proxies
- Import at least 40 test credentials

**Steps:**
1. Start the credential check runner
2. Monitor console logs for worker startup
3. Monitor WebSocket messages for credential updates
4. Let the system run for 2-3 minutes

**Expected Behavior:**
- No errors in console
- Workers process credentials sequentially
- Proxies rotate between proxy1 and proxy2 within each worker
- Credentials update status (PENDING → CHECKING → VALID/INVALID)

**Verification:**
```sql
-- Check that credentials are being processed
SELECT status, COUNT(*) FROM Credential GROUP BY status;
-- Should see counts for CHECKING, VALID, INVALID

-- Check proxy statuses
SELECT status, COUNT(*) FROM Proxy GROUP BY status;
-- Should see IN_USE for assigned proxies
```

**Console Log Patterns:**
```
Starting worker-1 with proxies: proxy1.com:8080, proxy2.com:8080
Starting worker-2 with proxies: proxy3.com:8080, proxy4.com:8080
...
[worker-1] Processing credential batch...
[worker-2] Processing credential batch...
```

---

### Test Case 2.2: Proxy Rotation (Round-Robin)
**Setup:**
- Import 4 proxies (creates 2 workers with 2 proxies each)
- Import 10 test credentials

**Steps:**
1. Start credential check runner
2. Monitor verification logs closely

**Expected Behavior:**
- Worker-1 alternates between proxy1 and proxy2
- Worker-2 alternates between proxy3 and proxy4
- Each verification uses different proxy within worker

**Verification:**
- Check PlaywrightVerify logs to see which proxy is used for each verification
- currentIndex should toggle between 0 and 1

---

### Test Case 2.3: Proxy Death Handling
**Setup:**
- Import 4 proxies
- Configure 1 proxy to be invalid (will fail)

**Steps:**
1. Start credential check runner
2. Wait for first verification to fail
3. Check database for proxy status

**Expected Behavior:**
- Failed proxy marked as DEAD
- Worker continues with second proxy
- If both proxies die, worker terminates with error

**Verification:**
```sql
SELECT status FROM Proxy WHERE server = 'invalid-proxy.com';
-- Should show 'DEAD'
```

**Console Log Expected:**
```
Error in worker-1: Proxy connection failed
-- Then worker continues with proxy2
```

---

### Test Case 2.4: Worker Termination on No Credentials
**Setup:**
- Import 80 proxies
- Ensure no PENDING credentials in database

**Steps:**
1. Start credential check runner
2. Wait 2-3 seconds

**Expected Behavior:**
- Workers start successfully
- Workers poll for credentials (find none)
- Workers continue polling (not terminated)
- No errors in logs

**Console Log Expected:**
```
Starting worker-1 with proxies: ...
-- Polling logs (processedCount = 0)
```

---

## Test Plan 3: Integration with Application

### Test Case 3.1: Start via HTTP API
**Setup:**
- Import 80 proxies
- Import test credentials
- Start application server

**Steps:**
1. Call POST /api/check/start
2. Monitor response
3. Call GET /api/check/status

**Expected Behavior:**
- Start returns 200
- Status shows: isRunning: true, activeWorkers: 40 (or workerCount based on proxies)
- totalProxies: 80
- activeProxies: 80

**Verification:**
```bash
curl -X POST http://localhost:3000/api/check/start
# Expected: {"message": "Credential check started"}

curl http://localhost:3000/api/check/status
# Expected JSON with isRunning: true, activeWorkers: <workerCount>
```

---

### Test Case 3.2: WebSocket Updates
**Setup:**
- Start application
- Connect frontend to WebSocket
- Start credential check

**Expected Behavior:**
- Real-time updates for credential status changes
- Real-time updates for check status

**Verification:**
- Open browser DevTools → Network → WS
- Monitor incoming WebSocket messages
- Should see credential:update events
- Should see check:status events

---

## Manual Testing Procedure

### Pre-Test Setup

1. **Backup database:**
```bash
cp prisma/dev.db prisma/dev.db.backup
```

2. **Clean database:**
```sql
DELETE FROM Credential;
DELETE FROM Proxy;
```

3. **Prepare test data (via HTTP API):**
```bash
# Use the bulk import endpoint to import 80 test proxies
curl -X POST http://localhost:3000/api/proxy/bulk-import \
  -H "Content-Type: application/json" \
  -d '{
    "proxies": [
      {"server": "proxy1.example.com:8080", "username": "user1", "password": "pass1"},
      {"server": "proxy2.example.com:8080", "username": "user2", "password": "pass2"},
      ... (repeat for 80 proxies)
    ]
  }'
```

4. **Start application in debug mode:**
```bash
AUTOMATE_DEBUG=true npm run dev
```

---

### Test Execution Order

1. **Test Case 1.4** (1 proxy - error) → Verify error handling
2. **Test Case 1.5** (0 proxies - error) → Verify error handling
3. **Test Case 1.3** (8 proxies) → Verify basic assignment
4. **Test Case 1.1** (80 proxies) → Verify max capacity
5. **Test Case 1.2** (120 proxies) → Verify capping at 40 workers
6. **Test Case 2.1** (credential flow) → Verify end-to-end flow
7. **Test Case 2.2** (proxy rotation) → Verify round-robin
8. **Test Case 2.3** (proxy death) → Verify error handling

---

### Cleanup

```bash
# Restore database
cp prisma/dev.db.backup prisma/dev.db

# Or clean up
DELETE FROM Proxy;
DELETE FROM Credential;
```

---

## Expected Console Output Summary

### Successful Start (80 proxies)
```
Assigned 40 workers with 40 primary proxies
Starting worker-1 with proxies: proxy1.example.com:8080, proxy2.example.com:8080
Starting worker-2 with proxies: proxy3.example.com:8080, proxy4.example.com:8080
...
Starting worker-40 with proxies: proxy79.example.com:8080, proxy80.example.com:8080
```

### Successful Start (8 proxies)
```
Assigned 4 workers with 4 primary proxies
Starting worker-1 with proxies: proxy1.example.com:8080, proxy2.example.com:8080
Starting worker-2 with proxies: proxy3.example.com:8080, proxy4.example.com:8080
Starting worker-3 with proxies: proxy5.example.com:8080, proxy6.example.com:8080
Starting worker-4 with proxies: proxy7.example.com:8080, proxy8.example.com:8080
```

### Error Start (1 proxy)
```
Error: Insufficient proxies: 1 available, 1 required (minimum 1 per worker)
```

---

## Status Endpoint Response

### 80 Proxies (Before Check)
```json
{
  "isRunning": false,
  "total": 0,
  "processed": 0,
  "startedAt": null,
  "finishedAt": null,
  "lastError": null,
  "concurrency": 40,
  "activeWorkers": 0,
  "totalProxies": 80,
  "activeProxies": 80,
  "deadProxies": 0,
  "workersWithDeadProxies": 0
}
```

### 80 Proxies (During Check)
```json
{
  "isRunning": true,
  "total": 40,
  "processed": 15,
  "startedAt": "2026-02-06T10:00:00.000Z",
  "finishedAt": null,
  "lastError": null,
  "concurrency": 40,
  "activeWorkers": 40,
  "totalProxies": 80,
  "activeProxies": 80,
  "deadProxies": 0,
  "workersWithDeadProxies": 0
}
```

---

## Sign-off Checklist

- [ ] Test Case 1.1: 80 proxies → 40 workers with 2 proxies each
- [ ] Test Case 1.2: 120 proxies → 40 workers (capped), 80 proxies used
- [ ] Test Case 1.3: 8 proxies → 4 workers with 2 proxies each
- [ ] Test Case 1.4: 1 proxy → Error thrown
- [ ] Test Case 1.5: 0 proxies → Error thrown
- [ ] Test Case 2.1: Credential checking flow works
- [ ] Test Case 2.2: Proxy rotation works (round-robin)
- [ ] Test Case 2.3: Proxy death handling works
- [ ] Test Case 3.1: HTTP API integration works
- [ ] Test Case 3.2: WebSocket updates work
- [ ] No console errors during normal operation
- [ ] Database states correct after tests
- [ ] All proxies return to ACTIVE after check stops

---

## Final Notes

**Implementation Location:**
- `/home/cnnt/self/rakuten/infrastructure/db/prisma/repositories/PrismaProxyRepository.ts` - `assignToWorkers()` method (lines 135-173)
- `/home/cnnt/self/rakuten/application/services/CredentialCheckRunner.ts` - `start()` method (lines 75-141)

**Key Algorithm:**
```typescript
// From PrismaProxyRepository.assignToWorkers()
const totalProxies = countResult[0].count;

if (totalProxies < 2) {
  return new Map(); // No workers with < 2 proxies
}

const maxConcurrency = 40;
const workerCount = Math.min(Math.floor(totalProxies / 2), maxConcurrency);
// Each worker gets exactly 2 proxies
```

**Verification Steps:**
1. Build the project: `npm run build`
2. Start in debug mode: `AUTOMATE_DEBUG=true npm run dev`
3. Import test proxies via HTTP API or database
4. Start credential check and monitor logs
5. Verify worker count matches expected calculation
6. Verify proxy rotation works within workers
7. Verify error handling for edge cases
