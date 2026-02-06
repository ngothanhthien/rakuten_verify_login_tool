# Delete All Proxies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Delete All" button to the ProxiesPage that removes all proxies with a single database operation.

**Architecture:** New backend endpoint `POST /api/proxies/delete-all` that calls repository's `deleteAll()` method using Prisma's `deleteMany()` for efficient bulk deletion. Frontend button triggers confirmation dialog, then calls API and refreshes the list.

**Tech Stack:** TypeScript, Express.js, Prisma ORM, Vue 3, Awilix DI container

---

### Task 1: Add deleteAll method to IProxyRepository interface

**Files:**
- Modify: `core/repositories/IProxyRepository.ts`

**Step 1: Add method signature to interface**

Add this method to the `IProxyRepository` interface (after the `delete` method):

```typescript
deleteAll(): Promise<number>;  // Returns count of deleted proxies
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build:backend`
Expected: SUCCESS with no type errors

**Step 3: Commit**

```bash
git add core/repositories/IProxyRepository.ts
git commit -m "feat: add deleteAll method to IProxyRepository interface"
```

---

### Task 2: Implement deleteAll in PrismaProxyRepository

**Files:**
- Modify: `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts`

**Step 1: Implement the deleteAll method**

Add this method to the `PrismaProxyRepository` class (after the `delete` method):

```typescript
async deleteAll(): Promise<number> {
  const result = await this.prisma.proxy.deleteMany({});
  return result.count;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build:backend`
Expected: SUCCESS with no type errors

**Step 3: Commit**

```bash
git add infrastructure/db/prisma/repositories/PrismaProxyRepository.ts
git commit -m "feat: implement deleteAll in PrismaProxyRepository"
```

---

### Task 3: Add deleteAll controller method

**Files:**
- Modify: `infrastructure/http/ProxyController.ts`

**Step 1: Add controller method**

Add this method to the `ProxyController` class (after the `bulkImport` method):

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

**Step 2: Verify TypeScript compiles**

Run: `npm run build:backend`
Expected: SUCCESS with no type errors

**Step 3: Commit**

```bash
git add infrastructure/http/ProxyController.ts
git commit -m "feat: add deleteAll controller method"
```

---

### Task 4: Add delete-all route

**Files:**
- Modify: `infrastructure/http/routes.ts`

**Step 1: Add the route**

Find the proxy routes section and add this route (after the bulk-import route):

```typescript
router.post('/proxies/delete-all', proxyController.deleteAll.bind(proxyController));
```

**Step 2: Verify TypeScript compiles**

Run: `npm run build:backend`
Expected: SUCCESS with no type errors

**Step 3: Commit**

```bash
git add infrastructure/http/routes.ts
git commit -m "feat: add delete-all route"
```

---

### Task 5: Add deleteAllProxies API function in frontend

**Files:**
- Modify: `frontend/src/repositories/api.ts`

**Step 1: Add API function**

Add this function to the api module (after `bulkImportProxies` function):

```typescript
export async function deleteAllProxies(): Promise<{ message: string; count: number }> {
  const response = await axios.post('/api/proxies/delete-all')
  return response.data
}
```

**Step 2: Verify frontend compiles**

Run: `cd frontend && npm run build`
Expected: SUCCESS with no type errors

**Step 3: Commit**

```bash
git add frontend/src/repositories/api.ts
git commit -m "feat: add deleteAllProxies API function"
```

---

### Task 6: Add deleteAll handler in ProxiesPage

**Files:**
- Modify: `frontend/src/pages/ProxiesPage.vue`

**Step 1: Add deletingAll state**

Add this ref after the existing state declarations (around line 12):

```typescript
const deletingAll = ref(false)
```

**Step 2: Add deleteAll function**

Add this function after the `rotate` function (around line 73):

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

**Step 3: Commit**

```bash
git add frontend/src/pages/ProxiesPage.vue
git commit -m "feat: add deleteAll handler with confirmation"
```

---

### Task 7: Add Delete All button to ProxiesPage template

**Files:**
- Modify: `frontend/src/pages/ProxiesPage.vue`

**Step 1: Add Delete All button**

In the template, find the button group (around line 93). Add this button between "Bulk Import" and "Refresh" buttons:

```vue
<button
  class="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
  :disabled="loading || deletingAll || proxies.length === 0"
  @click="deleteAll"
>
  {{ deletingAll ? 'Deleting...' : 'Delete All' }}
</button>
```

**Step 2: Verify frontend compiles**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/pages/ProxiesPage.vue
git commit -m "feat: add Delete All button to ProxiesPage"
```

---

### Task 8: Manual testing

**Files:** None

**Step 1: Start the application**

Run: `npm run dev`

**Step 2: Test the feature**

1. Navigate to Proxies page
2. Verify "Delete All" button is visible in header
3. Add some test proxies via Bulk Import
4. Click "Delete All" button
5. Verify confirmation dialog shows correct count
6. Confirm deletion
7. Verify alert shows success message with count
8. Verify table shows "No proxies yet."
9. Verify button is disabled when list is empty

**Step 4: Test error handling**

1. Check browser console for any errors
2. Verify error messages display correctly if API fails

**Step 5: Test edge cases**

1. Verify button disabled when `proxies.length === 0`
2. Verify button disabled during deletion
3. Cancel on confirmation dialog - verify nothing happens

**Step 6: Stop the application**

Press Ctrl+C in the terminal

**Step 7: Final commit**

```bash
git add -A
git commit -m "test: manually verified delete all proxies feature"
```

---

## Testing Checklist

- [ ] Button is disabled when proxy list is empty
- [ ] Confirm dialog shows correct proxy count
- [ ] Successful deletion clears the list
- [ ] Success alert shows deletion count
- [ ] Error handling displays appropriate messages
- [ ] Button disabled during deletion operation
- [ ] Cancel on confirm dialog does nothing

---

## Related Documentation

- Design doc: `docs/plans/2026-02-06-delete-all-proxies-design.md`
- Prisma deleteMany: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#deletemany
