# Bulk Proxy Import Design

**Date:** 2025-02-06
**Status:** Design Approved
**Author:** Claude

## Overview

Add bulk import functionality for proxies with format `ip:port:username:password`. Proxies are tested during import with 3 retries and latency threshold of 2000ms. Invalid lines and failed tests are skipped, with a detailed summary returned.

## API Endpoint

**Endpoint:** `POST /api/proxies/bulk-import`

**Request Body:**
```json
{
  "proxies": "103.49.63.100:2649:user1:pass1\n103.49.63.100:2176:user2:pass2\n..."
}
```

**Response:**
```json
{
  "created": 5,
  "updated": 2,
  "skipped": 4,
  "errors": [
    { "line": 5, "raw": "103.49.63.100:9999:user:pass", "error": "Failed after 3 retries - timeout" }
  ]
}
```

## Import Logic

1. Parse each line as `ip:port:username:password`
2. Test connection with 3 retries, accept if latency < 2000ms
3. Only save if test passes
4. Check for existing proxy by server (ip:port) → update or create
5. Skip failed tests and invalid lines
6. Return summary of results

## Architecture

### New Components

**Use Case:** `application/use-cases/BulkImportProxies.ts`

Responsibilities:
- Parse raw multiline string into proxy entries
- Coordinate testing and import flow
- Handle duplicates (check existing by server)
- Aggregate results for summary response

### Repository Addition

Add to `IProxyRepository` interface:
```typescript
findByServer(server: string): Promise<Proxy | null>
```

Implementation in `PrismaProxyRepository.ts`:
```typescript
async findByServer(server: string): Promise<Proxy | null> {
  const records = await prisma.$queryRaw<ProxyRow[]>`
    SELECT id, server, username, password, status, usageCount, usedAt
    FROM "Proxy"
    WHERE server = ${server}
    LIMIT 1
  `;
  return records[0] ? this.toEntity(records[0]) : null;
}
```

### Testing Strategy

Reuse `testHttpProxyConnect` from `ProxyController.ts` with retry wrapper:
- Try up to 3 times
- Stop on first success with latency < 2000ms
- Skip if all retries fail or exceed latency threshold

## Data Flow

```
Request → Controller → BulkImportProxies Use Case
                              ↓
                         Parse lines
                              ↓
                    For each parsed proxy:
                    ┌─────────────────────┐
                    │ Test with 3 retries  │
                    └─────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │ Pass? Check existing │
                    └─────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │ Create or Update     │
                    └─────────────────────┘
                              ↓
                         Aggregate results
                              ↓
                         Return summary
```

## Error Handling

### Parsing Errors
- Empty lines → skip
- Invalid format (not `ip:port:user:pass`) → skip with error
- Invalid port number → skip with error
- Invalid IP format → skip with error

### Testing Failures
- Connection timeout → retry up to 3 times, then skip
- Auth failure → skip (don't retry, won't work)
- Latency ≥ 2000ms → skip

### Duplicate Handling
- Same `server` (ip:port) exists → update credentials and status
- Preserve existing `usageCount` and `usedAt` (don't reset on update)

### Concurrency
- Process tests in parallel batches (configurable, default 5 concurrent)
- Prevent overwhelming network with too many simultaneous connections

## Files to Modify

1. **New:** `application/use-cases/BulkImportProxies.ts`
2. **Modify:** `core/repositories/IProxyRepository.ts` - Add `findByServer()`
3. **Modify:** `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts` - Implement `findByServer()`
4. **Modify:** `infrastructure/http/ProxyController.ts` - Add `bulkImport()` endpoint
5. **Modify:** `infrastructure/http/routes.ts` - Add bulk import route

## Testing

### Unit Tests
- `BulkImportProxies` use case with mocked repository and tester
- Parser function for various valid/invalid formats
- Retry logic with mocked test results

### Integration Tests
- Full import flow with test database
- Duplicate detection and update behavior
- Error summary accuracy

### Test Cases for Parser
```
Valid:   "103.49.63.100:2649:user:pass"
Invalid: "103.49.63.100" (missing parts)
Invalid: "invalid:port:user:pass" (bad IP)
Invalid: "103.49.63.100:abc:user:pass" (bad port)
Empty:   ""
```

### Test Cases for Import
- All new proxies → all created
- Mix of new and existing → created/updated split
- All duplicates → all updated
- All invalid → all skipped with errors
