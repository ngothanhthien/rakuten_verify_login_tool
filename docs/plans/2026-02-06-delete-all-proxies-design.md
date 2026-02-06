# Delete All Proxies Design

**Date:** 2026-02-06
**Status:** Design Approved

## Overview

Add a "Delete All" button to the ProxiesPage that removes all proxies with a single database operation, preceded by a simple confirmation dialog.

## User Flow

1. User clicks "Delete All" button in ProxiesPage header
2. Confirmation dialog appears: "Delete all N proxies? This cannot be undone."
3. If confirmed, call `POST /api/proxies/delete-all`
4. Backend deletes all proxies in one database operation
5. Frontend refreshes the proxy list (now empty)
6. Success alert shows deletion count

## Backend Changes

### Repository Layer

**File:** `core/repositories/IProxyRepository.ts`

Add method signature:
```typescript
deleteAll(): Promise<number>  // Returns count of deleted proxies
```

**File:** `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts`

Implement method:
```typescript
async deleteAll(): Promise<number> {
  const result = await this.prisma.proxy.deleteMany({});
  return result.count;
}
```

Uses Prisma's `deleteMany()` for efficient single-operation deletion.

### Controller Layer

**File:** `infrastructure/http/ProxyController.ts`

Add method:
```typescript
async deleteAll(req: Request, res: Response) {
  try {
    const count = await this.proxyRepository.deleteAll();
    res.json({ message: `Deleted ${count} proxy(ies)`, count });
  } catch (error) {
    console.error("Error in proxies deleteAll:", error);
    res.status(500).json({ message: error?.message ?? "Internal server error" });
  }
}
```

### Routes

**File:** `infrastructure/http/routes.ts`

Add route:
```typescript
router.post('/proxies/delete-all', proxyController.deleteAll.bind(proxyController));
```

## Frontend Changes

### API Client

**File:** `frontend/src/repositories/api.ts`

Add function:
```typescript
export async function deleteAllProxies(): Promise<{ message: string; count: number }> {
  const response = await axios.post('/api/proxies/delete-all')
  return response.data
}
```

### Page Component

**File:** `frontend/src/pages/ProxiesPage.vue`

**Add state:**
```typescript
const deletingAll = ref(false)
```

**Add handler:**
```typescript
async function deleteAll() {
  const confirmed = confirm(`Delete all ${proxies.value.length} proxies? This cannot be undone.`)
  if (!confirmed) return

  deletingAll.value = true
  error.value = null
  try {
    const result = await api.deleteAllProxies()
    alert(result.message)
    await fetchProxies()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to delete proxies'
  } finally {
    deletingAll.value = false
  }
}
```

**Add button in header** (between "Bulk Import" and "Refresh"):
```vue
<button
  class="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
  :disabled="loading || deletingAll || proxies.length === 0"
  @click="deleteAll"
>
  {{ deletingAll ? 'Deleting...' : 'Delete All' }}
</button>
```

## Data Flow

```
User clicks "Delete All"
       ↓
JavaScript confirm dialog shows count
       ↓
User confirms (or cancels)
       ↓
POST /api/proxies/delete-all
       ↓
Backend: proxyRepository.deleteAll()
       ↓
Prisma: DELETE FROM proxy (single operation)
       ↓
Return { message: "Deleted N proxies", count: N }
       ↓
Frontend shows alert with message
       ↓
fetchProxies() refreshes list
       ↓
Table shows "No proxies yet."
```

## Error Handling

- **Frontend validation:** Button disabled when `proxies.length === 0`
- **User cancellation:** `confirm()` returns false, function exits early
- **Network error:** Caught in try/catch, displayed in error banner
- **Backend error:** Logged to console, returns 500 with error message
- **Database error:** Prisma error propagates through layers

## Edge Cases

- Empty proxy list: Button disabled, no action possible
- Concurrent changes: Actual count may differ if list changes between confirmation and deletion (acceptable)
- Zero deletions: Returns count: 0 if table is empty when request reaches backend

## Design Decisions

- No filtering - deletes everything regardless of status or usage
- Single backend endpoint for efficiency (one DB transaction vs. many)
- Follows existing confirmation pattern from individual delete
- Button styled as destructive (red/warning color) to indicate dangerous action
- Shows count in confirmation dialog for clarity

## Files to Modify

1. `core/repositories/IProxyRepository.ts` - Add method signature
2. `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts` - Implement method
3. `infrastructure/http/ProxyController.ts` - Add controller method
4. `infrastructure/http/routes.ts` - Add route
5. `frontend/src/repositories/api.ts` - Add API function
6. `frontend/src/pages/ProxiesPage.vue` - Add button and handler

## Testing Checklist

- [ ] Button is disabled when proxy list is empty
- [ ] Confirm dialog shows correct proxy count
- [ ] Successful deletion clears the list
- [ ] Success alert shows deletion count
- [ ] Error handling displays appropriate messages
- [ ] Button disabled during deletion operation
- [ ] Cancel on confirm dialog does nothing
