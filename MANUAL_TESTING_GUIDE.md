# Manual Testing Guide - Proxy Injection Implementation

This document outlines the manual testing steps to verify the proxy injection implementation works correctly.

## Build Verification

**Status**: ✅ PASSED

The project builds successfully:
- Frontend: Vue 3 application compiled to `frontend-dist/`
- Backend: TypeScript compiled to `dist/` with ESM import fixes applied
- Prisma Client: Generated successfully from schema

## Test Environment Setup

### Prerequisites
1. SQLite database with proxy table
2. At least 80 active proxy entries for full testing
3. Application logs monitoring capability
4. Ability to simulate proxy failures

## Manual Test Cases

### Test Case 1: Minimum Proxy Validation

**Purpose**: Verify application rejects insufficient proxies at startup

**Steps**:
```sql
-- Clear existing proxies
DELETE FROM Proxy;

-- Add fewer than minimum required (39 proxies)
INSERT INTO Proxy (id, host, port, username, password, status, createdAt, updatedAt)
VALUES
  ('proxy-1', '192.168.1.1', 8080, 'user1', 'pass1', 'ACTIVE', datetime('now'), datetime('now')),
  ('proxy-2', '192.168.1.2', 8080, 'user2', 'pass2', 'ACTIVE', datetime('now'), datetime('now')),
  -- ... repeat for 37 more proxies (total 39)
  ('proxy-39', '192.168.1.39', 8080, 'user39', 'pass39', 'ACTIVE', datetime('now'), datetime('now'));
```

**Expected Result**:
- Application startup fails with error: "Insufficient proxies"
- Error message indicates minimum required: 40 proxies for 20 workers

**Verification Point**:
```bash
# Check application logs
npm run start:dev

# Should see:
# ERROR: Insufficient proxies: Need at least 40 for 20 workers (2 proxies per worker)
```

---

### Test Case 2: Full Worker Assignment (80 Proxies)

**Purpose**: Verify correct worker-proxy assignment with sufficient proxies

**Steps**:
```sql
-- Clear existing proxies
DELETE FROM Proxy;

-- Add 80 ACTIVE proxies
INSERT INTO Proxy (id, host, port, username, password, status, createdAt, updatedAt)
VALUES
  ('proxy-1', '192.168.1.1', 8080, 'user1', 'pass1', 'ACTIVE', datetime('now'), datetime('now')),
  ('proxy-2', '192.168.1.2', 8080, 'user2', 'pass2', 'ACTIVE', datetime('now'), datetime('now')),
  -- ... repeat for 78 more proxies (total 80)
  ('proxy-80', '192.168.1.80', 8080, 'user80', 'pass80', 'ACTIVE', datetime('now'), datetime('now'));
```

**Expected Result**:
- Application starts successfully
- Log message: "Assigned 40 workers with 80 primary proxies"
- Workers are ready to process credentials
- Each worker has exactly 2 proxies assigned

**Verification Points**:
```bash
# Check startup logs
npm run start:dev

# Should see:
# INFO: Worker pool ready with 40 workers
# INFO: Assigned 40 workers with 80 primary proxies

# Verify in database (if worker assignments are persisted)
SELECT * FROM WorkerProxyAssignment ORDER BY workerId;
# Should show 40 workers with 2 proxies each
```

---

### Test Case 3: Worker Processing with Proxies

**Purpose**: Verify workers use assigned proxies for credential verification

**Steps**:
1. Start application with 80 proxies
2. Import credentials to be verified
3. Monitor worker behavior

**Expected Result**:
- Workers process credentials using their assigned proxies
- Each worker maintains its proxy assignment throughout processing
- No proxy conflicts between workers

**Verification Points**:
```bash
# Monitor logs
npm run start:dev

# Should see worker activity:
# DEBUG: Worker 1 processing credential using proxy proxy-1
# DEBUG: Worker 2 processing credential using proxy proxy-3
# etc.

# Check credential verification results
SELECT id, status, verifiedAt FROM Credential WHERE status = 'VALID' LIMIT 10;
```

---

### Test Case 4: Primary Proxy Failure - Failover to Secondary

**Purpose**: Verify worker switches to secondary proxy when primary fails

**Steps**:
1. Start application with 80 proxies
2. Let workers begin processing credentials
3. Simulate failure of a primary proxy:
   ```sql
   UPDATE Proxy SET status = 'DEAD' WHERE id = 'proxy-1';
   ```
4. Observe worker behavior

**Expected Result**:
- Worker that was using proxy-1 switches to its secondary proxy
- Log message indicates failover
- Worker continues processing without interruption

**Verification Points**:
```bash
# Monitor logs
npm run start:dev

# Should see:
# WARN: Primary proxy proxy-1 failed for Worker 1, switching to secondary proxy proxy-2
# DEBUG: Worker 1 now using proxy-2

# Verify proxy status in database
SELECT id, status FROM Proxy WHERE id = 'proxy-1';
# Should show status 'DEAD'
```

---

### Test Case 5: Both Proxies Fail - Worker Termination

**Purpose**: Verify worker terminates when both assigned proxies fail

**Steps**:
1. Start application with 80 proxies
2. Let workers begin processing credentials
3. Kill both proxies for a specific worker:
   ```sql
   UPDATE Proxy SET status = 'DEAD' WHERE id IN ('proxy-1', 'proxy-2');
   ```
4. Observe worker behavior

**Expected Result**:
- Worker using both failed proxies terminates gracefully
- Log message indicates worker termination
- No credential processing by that worker after termination
- Other workers continue normally

**Verification Points**:
```bash
# Monitor logs
npm run start:dev

# Should see:
# ERROR: Both proxies failed for Worker 1 (proxy-1, proxy-2), terminating worker
# INFO: Worker 1 terminated

# Verify worker no longer processes credentials
# Worker 1 should not appear in subsequent log entries
```

---

### Test Case 6: Concurrent Worker Operations

**Purpose**: Verify multiple workers operate independently without conflicts

**Steps**:
1. Start application with 80 proxies
2. Import multiple credentials (e.g., 100)
3. Monitor concurrent processing

**Expected Result**:
- All 40 workers process credentials simultaneously
- No proxy conflicts between workers
- Each worker uses only its assigned two proxies
- Processing completes successfully

**Verification Points**:
```bash
# Monitor logs for concurrent activity
npm run start:dev

# Should see multiple workers active:
# DEBUG: Worker 1 processing credential [credential-id] with proxy proxy-1
# DEBUG: Worker 2 processing credential [credential-id] with proxy proxy-3
# DEBUG: Worker 3 processing credential [credential-id] with proxy proxy-5
# ... (multiple workers simultaneously)

# Check processing results
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END) as valid,
  SUM(CASE WHEN status = 'INVALID' THEN 1 ELSE 0 END) as invalid,
  SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as errors
FROM Credential;
```

---

### Test Case 7: Proxy Recovery

**Purpose**: Verify application handles proxy status changes correctly

**Steps**:
1. Start application with 80 proxies
2. Mark a proxy as DEAD:
   ```sql
   UPDATE Proxy SET status = 'DEAD' WHERE id = 'proxy-1';
   ```
3. Worker fails over to secondary proxy
4. Mark proxy as ACTIVE again:
   ```sql
   UPDATE Proxy SET status = 'ACTIVE' WHERE id = 'proxy-1';
   ```
5. Observe if application notices the recovery

**Expected Result**:
- Application may or may not automatically recover the proxy
- If automatic recovery is implemented, worker should resume using the recovered proxy
- Manual restart may be required if automatic recovery is not implemented

**Verification Points**:
```bash
# Check if proxy is reused after recovery
# Monitor logs for proxy-1 usage after status change to ACTIVE

# OR verify manual restart works:
# After marking proxy back to ACTIVE, restart application
npm run start:dev

# Should see proxy-1 available for assignment
```

---

## Test Data Generation

### SQL Script for 80 Active Proxies

```sql
-- Clear existing proxies
DELETE FROM Proxy;

-- Generate 80 active proxies
-- Replace with actual proxy details in production
WITH proxy_cte AS (
  SELECT
    'proxy-' || ROWID AS id,
    '192.168.1.' || ROWID AS host,
    8080 AS port,
    'user' || ROWID AS username,
    'pass' || ROWID AS password,
    'ACTIVE' AS status,
    datetime('now') AS createdAt,
    datetime('now') AS updatedAt
  FROM (
    SELECT 1 AS ROWID UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
    -- ... continue to 80
    SELECT 80
  )
)
INSERT INTO Proxy (id, host, port, username, password, status, createdAt, updatedAt)
SELECT * FROM proxy_cte;
```

---

## Monitoring and Debugging

### Key Log Messages to Watch

1. **Startup Success**:
   - `INFO: Worker pool ready with 40 workers`
   - `INFO: Assigned 40 workers with 80 primary proxies`

2. **Startup Failure**:
   - `ERROR: Insufficient proxies: Need at least X for Y workers`

3. **Proxy Failover**:
   - `WARN: Primary proxy [id] failed for Worker [id], switching to secondary`

4. **Worker Termination**:
   - `ERROR: Both proxies failed for Worker [id]`

5. **Credential Processing**:
   - `DEBUG: Worker [id] processing credential [id] with proxy [id]`

### Database Queries for Verification

```sql
-- Check proxy distribution
SELECT
  COUNT(*) as total_proxies,
  SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN status = 'DEAD' THEN 1 ELSE 0 END) as dead
FROM Proxy;

-- Check worker assignments (if persisted)
SELECT
  workerId,
  COUNT(*) as proxy_count,
  GROUP_CONCAT(proxyId) as proxies
FROM WorkerProxyAssignment
GROUP BY workerId
ORDER BY workerId;

-- Check credential processing by worker
SELECT
  workerId,
  COUNT(*) as processed,
  SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END) as valid
FROM CredentialProcessingLog
GROUP BY workerId
ORDER BY workerId;
```

---

## Success Criteria

All test cases pass if:

1. ✅ Build completes without errors
2. ✅ Application rejects insufficient proxies (< 40 for 20 workers)
3. ✅ Application starts successfully with 80 proxies (40 workers)
4. ✅ Workers process credentials using assigned proxies
5. ✅ Workers failover to secondary proxy when primary fails
6. ✅ Workers terminate when both proxies fail
7. ✅ Multiple workers operate concurrently without conflicts
8. ✅ No proxy conflicts or duplicate assignments

---

## Notes

- **Test Environment**: These tests should be run in a development/staging environment
- **Real Proxies**: Replace placeholder proxy data with actual working proxies for real testing
- **Mock Proxies**: For initial testing, mock proxies can be used if actual proxies are not available
- **Log Level**: Set `LOG_LEVEL=debug` in environment for detailed debugging information
- **Monitoring**: Consider using a log aggregation tool (e.g., Winston, ELK stack) for better visibility

---

## Issue Reporting

If any test case fails, document:

1. Test case number
2. Expected behavior
3. Actual behavior
4. Log excerpts
5. Database state at failure time
6. Steps to reproduce

Example:
```
Test Case: 4 - Primary Proxy Failure
Expected: Worker switches to secondary proxy
Actual: Worker terminates instead
Logs: [paste relevant log entries]
Database: [show proxy status]
```
