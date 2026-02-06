# Bulk Proxy Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bulk proxy import functionality with format `ip:port:username:password`, testing each proxy with 3 retries and latency < 2000ms.

**Architecture:** New `BulkImportProxies` use case coordinates parsing, testing, and persistence. Tests run in parallel batches (5 concurrent). Duplicates detected by `server` field are updated rather than created.

**Tech Stack:** TypeScript, Express.js, Prisma (SQLite raw SQL), Awilix DI container

---

### Task 1: Add findByServer to Repository Interface

**Files:**
- Modify: `core/repositories/IProxyRepository.ts`

**Step 1: Add method signature to interface**

```typescript
findByServer(server: string): Promise<Proxy | null>;
```

Add this method after the `findById` declaration (around line 7).

**Step 2: Commit**

```bash
git add core/repositories/IProxyRepository.ts
git commit -m "feat: add findByServer to proxy repository interface"
```

---

### Task 2: Implement findByServer in PrismaProxyRepository

**Files:**
- Modify: `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts`

**Step 1: Write the implementation**

Add this method after the `findById` method (around line 30):

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

**Step 2: Commit**

```bash
git add infrastructure/db/prisma/repositories/PrismaProxyRepository.ts
git commit -m "feat: implement findByServer in PrismaProxyRepository"
```

---

### Task 3: Create Proxy Parser Utility

**Files:**
- Create: `application/utils/parseProxyLine.ts`

**Step 1: Write the parser with tests**

```typescript
export interface ParsedProxy {
  server: string;
  username: string;
  password: string;
  valid: boolean;
  error?: string;
}

export function parseProxyLine(line: string): ParsedProxy {
  const trimmed = line.trim();
  if (!trimmed) {
    return { server: "", username: "", password: "", valid: false, error: "Empty line" };
  }

  const parts = trimmed.split(":");
  if (parts.length !== 4) {
    return { server: "", username: "", password: "", valid: false, error: "Invalid format, expected ip:port:username:password" };
  }

  const [ip, portStr, username, password] = parts;

  // Validate IP (basic check)
  const ipParts = ip.split(".");
  if (ipParts.length !== 4 || ipParts.some(p => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
    return { server: "", username: "", password: "", valid: false, error: "Invalid IP address" };
  }

  // Validate port
  const port = Number(portStr);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { server: "", username: "", password: "", valid: false, error: "Invalid port number" };
  }

  // Validate username and password are not empty
  if (!username || !password) {
    return { server: "", username: "", password: "", valid: false, error: "Username and password required" };
  }

  const server = `${ip}:${port}`;

  return { server, username, password, valid: true };
}
```

**Step 2: Commit**

```bash
git add application/utils/parseProxyLine.ts
git commit -m "feat: add proxy line parser utility"
```

---

### Task 4: Create Proxy Tester with Retry Logic

**Files:**
- Create: `application/utils/testProxyWithRetry.ts`

**Step 1: Write the retry tester**

```typescript
export interface TestResult {
  ok: boolean;
  elapsedMs: number;
  ip?: string;
  error?: string;
}

export async function testProxyWithRetry(
  server: string,
  username: string,
  password: string,
  maxRetries: number = 3,
  maxLatencyMs: number = 2000
): Promise<TestResult> {
  // Import the test function from controller (will need to be extracted)
  // For now, we'll extract testHttpProxyConnect to a shared utility first
  return { ok: true, elapsedMs: 100 }; // Placeholder
}
```

**Step 2: Commit**

```bash
git add application/utils/testProxyWithRetry.ts
git commit -m "feat: add proxy retry tester stub"
```

---

### Task 5: Extract testHttpProxyConnect to Shared Utility

**Files:**
- Create: `infrastructure/http/testHttpProxyConnect.ts`
- Modify: `infrastructure/http/ProxyController.ts`

**Step 1: Create the shared utility**

Move `testHttpProxyConnect`, `parseProxyEndpoint`, and `decodeChunkedBody` functions from `ProxyController.ts` to a new file:

```typescript
// infrastructure/http/testHttpProxyConnect.ts
import net from "node:net";
import tls from "node:tls";

export function parseProxyEndpoint(server: string): { host: string; port: number } {
  const trimmed = server.trim();
  if (!trimmed) {
    throw new Error("server is required");
  }

  const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 80;

  if (!host) {
    throw new Error("Invalid proxy server host");
  }
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid proxy server port");
  }

  return { host, port };
}

export interface TestProxyOptions {
  proxyServer: string;
  proxyUsername: string | null;
  proxyPassword: string | null;
  timeoutMs?: number;
}

export interface TestProxyResult {
  ok: boolean;
  statusCode?: number;
  ip?: string;
  error?: string;
  elapsedMs: number;
}

export async function testHttpProxyConnect(opts: TestProxyOptions): Promise<TestProxyResult> {
  // Move the entire implementation from ProxyController.ts here
  // (lines 39-218 from the existing file)
}
```

**Step 2: Update ProxyController to import and use the shared function**

At the top of `ProxyController.ts`:
```typescript
import { testHttpProxyConnect } from "./testHttpProxyConnect";
```

Delete the moved functions from the controller.

**Step 3: Commit**

```bash
git add infrastructure/http/testHttpProxyConnect.ts infrastructure/http/ProxyController.ts
git commit -m "refactor: extract testHttpProxyConnect to shared utility"
```

---

### Task 6: Complete testProxyWithRetry Implementation

**Files:**
- Modify: `application/utils/testProxyWithRetry.ts`

**Step 1: Implement the retry logic**

```typescript
import { testHttpProxyConnect } from "../../infrastructure/http/testHttpProxyConnect";

export interface TestResult {
  ok: boolean;
  elapsedMs: number;
  ip?: string;
  error?: string;
}

export async function testProxyWithRetry(
  server: string,
  username: string,
  password: string,
  maxRetries: number = 3,
  maxLatencyMs: number = 2000
): Promise<TestResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await testHttpProxyConnect({
      proxyServer: server,
      proxyUsername: username,
      proxyPassword: password,
      timeoutMs: maxLatencyMs,
    });

    if (result.ok && result.elapsedMs < maxLatencyMs) {
      return result;
    }

    lastError = result.error || `Attempt ${attempt} failed`;
  }

  return { ok: false, elapsedMs: 0, error: lastError };
}
```

**Step 2: Commit**

```bash
git add application/utils/testProxyWithRetry.ts
git commit -m "feat: implement proxy test retry logic"
```

---

### Task 7: Create BulkImportProxies Use Case

**Files:**
- Create: `application/use-cases/BulkImportProxies.ts`

**Step 1: Write the use case**

```typescript
import type IProxyRepository from "../../core/repositories/IProxyRepository";
import type CreateProxyData from "../../core/value-objects/CreateProxyData";
import { parseProxyLine, ParsedProxy } from "../utils/parseProxyLine";
import { testProxyWithRetry } from "../utils/testProxyWithRetry";

export interface BulkImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ line: number; raw: string; error: string }>;
}

export interface BulkImportProxiesDeps {
  proxyRepository: IProxyRepository;
}

export class BulkImportProxies {
  constructor(private readonly deps: BulkImportProxiesDeps) {}

  async execute(proxiesText: string, concurrency: number = 5): Promise<BulkImportResult> {
    const lines = proxiesText.split("\n");
    const result: BulkImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Parse all lines first
    const parsed: Array<{ line: number; proxy: ParsedProxy; raw: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const proxy = parseProxyLine(lines[i]);
      if (!proxy.valid) {
        if (lines[i].trim()) {
          result.errors.push({ line: i + 1, raw: lines[i], error: proxy.error || "Invalid" });
          result.skipped++;
        }
      } else {
        parsed.push({ line: i + 1, proxy, raw: lines[i] });
      }
    }

    // Test and import in batches
    for (let i = 0; i < parsed.length; i += concurrency) {
      const batch = parsed.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async ({ proxy }) => {
          const testResult = await testProxyWithRetry(proxy.server, proxy.username, proxy.password);

          if (!testResult.ok) {
            result.skipped++;
            result.errors.push({
              line: proxy.line,
              raw: proxy.raw,
              error: testResult.error || "Test failed",
            });
            return;
          }

          // Check for existing
          const existing = await this.deps.proxyRepository.findByServer(proxy.server);

          if (existing) {
            await this.deps.proxyRepository.update(existing.id, {
              username: proxy.username,
              password: proxy.password,
            });
            result.updated++;
          } else {
            await this.deps.proxyRepository.create({
              server: proxy.server,
              username: proxy.username,
              password: proxy.password,
              status: "ACTIVE",
            });
            result.created++;
          }
        })
      );
    }

    return result;
  }
}
```

**Step 2: Commit**

```bash
git add application/use-cases/BulkImportProxies.ts
git commit -m "feat: add BulkImportProxies use case"
```

---

### Task 8: Register BulkImportProxies in DI Container

**Files:**
- Modify: `container.ts`

**Step 1: Add the use case registration**

Find the use case registration section and add:

```typescript
bulkImportProxies: asClass(BulkImportProxies).scoped(),
```

**Step 2: Commit**

```bash
git add container.ts
git commit -m "feat: register BulkImportProxies in DI container"
```

---

### Task 9: Add bulkImport Endpoint to ProxyController

**Files:**
- Modify: `infrastructure/http/ProxyController.ts`

**Step 1: Add the controller method**

```typescript
import { BulkImportProxies } from "../../application/use-cases/BulkImportProxies";

export default class ProxyController {
  constructor(
    private readonly proxyRepository: IProxyRepository,
    private readonly bulkImportProxies: BulkImportProxies,  // Add this
  ) {}

  // ... existing methods ...

  async bulkImport(req: Request, res: Response) {
    try {
      const { proxies } = req.body ?? {};

      if (typeof proxies !== "string") {
        return res.status(400).json({ message: "proxies is required and must be a string" });
      }

      const result = await this.bulkImportProxies.execute(proxies);
      res.json(result);
    } catch (error) {
      console.error("Error in proxies bulkImport:", error);
      res.status(500).json({ message: error?.message ?? "Internal server error" });
    }
  }
}
```

**Step 2: Commit**

```bash
git add infrastructure/http/ProxyController.ts
git commit -m "feat: add bulkImport endpoint to ProxyController"
```

---

### Task 10: Add Bulk Import Route

**Files:**
- Modify: `infrastructure/http/routes.ts`

**Step 1: Add the route**

Find the proxy routes section and add:

```typescript
router.post("/proxies/bulk-import", (req, res) => proxyController.bulkImport(req, res));
```

**Step 2: Commit**

```bash
git add infrastructure/http/routes.ts
git commit -m "feat: add bulk import route"
```

---

### Task 11: Manual Testing

**Step 1: Start the application**

```bash
npm run dev
```

**Step 2: Test with curl**

```bash
curl -X POST http://localhost:3000/api/proxies/bulk-import \
  -H "Content-Type: application/json" \
  -d '{
    "proxies": "103.49.63.100:2649:user1:pass1\n103.49.63.100:2176:user2:pass2\ninvalid:line:user:pass"
  }'
```

Expected response:
```json
{
  "created": 1,
  "updated": 0,
  "skipped": 2,
  "errors": [
    {
      "line": 3,
      "raw": "invalid:line:user:pass",
      "error": "Invalid IP address"
    }
  ]
}
```

**Step 3: Verify proxies in database**

```bash
sqlite3 data.db "SELECT id, server, username, status FROM Proxy ORDER BY id DESC LIMIT 5"
```

---

### Task 12: Final Commit and Validation

**Step 1: Run the application and verify no TypeScript errors**

```bash
npm run build:backend
```

**Step 2: Run the full application**

```bash
npm start
```

**Step 3: Create final summary commit**

```bash
git add -A
git commit -m "feat: complete bulk proxy import implementation

- Add findByServer to repository interface and implementation
- Create proxy line parser utility
- Extract testHttpProxyConnect to shared utility
- Create proxy tester with retry logic
- Implement BulkImportProxies use case
- Add bulk-import API endpoint
- Support parallel testing with configurable concurrency
- Skip invalid lines and failed tests
- Update existing proxies by server

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Notes for Implementation

- The `testHttpProxyConnect` function needs careful extraction - ensure all imports move with it
- DI container registration must match the constructor parameters of ProxyController
- SQLite stores dates as strings, ensure date parsing works correctly
- Error messages should be user-friendly but specific enough for debugging
- The concurrency limit prevents overwhelming the network during testing
