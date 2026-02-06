# Bulk Proxy Import UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bulk import modal UI for proxies, remove single proxy creation form and API endpoint.

**Architecture:** Vue modal component communicates with existing `/api/proxies/bulk-import` endpoint. Frontend uses Axios for API calls. State managed with Vue 3 Composition API refs.

**Tech Stack:** Vue 3, TypeScript, Axios, Express.js, Reka UI components (Dialog/Modal)

---

## Task 1: Create BulkImportModal Component

**Files:**
- Create: `frontend/src/parts/HomePage/BulkImportModal.vue`

**Step 1: Create the modal component structure**

Create file with template, script, and styles:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import * as api from '@/repositories/api'

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ line: number, raw: string, error: string }>
}

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'imported'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const text = ref('')
const importing = ref(false)
const result = ref<ImportResult | null>(null)
const error = ref<string | null>(null)

const isOpen = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  isOpen.value = val
  if (val) {
    // Reset state when opening
    text.value = ''
    result.value = null
    error.value = null
  }
})

function close() {
  emit('update:modelValue', false)
}

async function doImport() {
  const trimmed = text.value.trim()
  if (!trimmed) {
    error.value = 'Please enter at least one proxy'
    return
  }

  importing.value = true
  error.value = null
  result.value = null

  try {
    const response = await api.bulkImportProxies(trimmed)
    result.value = response
    emit('imported')

    // Auto-close after 2 seconds if successful
    setTimeout(() => {
      close()
    }, 2000)
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Import failed'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-background rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b">
        <h2 class="text-lg font-semibold">Bulk Import Proxies</h2>
        <button
          @click="close"
          :disabled="importing"
          class="rounded-md px-2 py-1 text-sm hover:bg-muted disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 overflow-y-auto flex-1 space-y-4">
        <!-- Instructions -->
        <div class="text-sm text-muted-foreground space-y-1">
          <p><strong>Format:</strong> ip:port:username:password (one per line)</p>
          <p class="text-xs">Proxies will be tested before import (latency < 2000ms required)</p>
        </div>

        <!-- Error message -->
        <div v-if="error" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {{ error }}
        </div>

        <!-- Result summary -->
        <div v-if="result" class="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
          <p><strong>Import Complete:</strong></p>
          <p>✅ Created: {{ result.created }}</p>
          <p>🔄 Updated: {{ result.updated }}</p>
          <p>⏭️ Skipped: {{ result.skipped }}</p>
          <p v-if="result.errors.length" class="text-destructive">❌ Errors: {{ result.errors.length }}</p>
        </div>

        <!-- Textarea -->
        <div class="space-y-2">
          <textarea
            v-model="text"
            :disabled="importing"
            class="w-full h-64 rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder="103.49.63.100:2649:user1:pass1&#10;103.49.63.100:2176:user2:pass2&#10;..."
          />
        </div>

        <!-- Example -->
        <div class="text-xs text-muted-foreground">
          <p><strong>Example:</strong></p>
          <pre class="font-mono bg-muted p-2 rounded mt-1">103.49.63.100:2649:username1:password1
103.49.63.100:2176:username2:password2</pre>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-2 p-4 border-t">
        <button
          @click="close"
          :disabled="importing"
          class="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="doImport"
          :disabled="importing || !text.trim()"
          class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {{ importing ? 'Importing...' : 'Import' }}
        </button>
      </div>
    </div>
  </div>
</template>
```

**Step 2: Commit the modal component**

```bash
git add frontend/src/parts/HomePage/BulkImportModal.vue
git commit -m "feat: add BulkImportModal component

Add modal for bulk proxy import with ip:port:user:pass format.
Shows import summary and auto-closes on success."
```

---

## Task 2: Add bulkImportProxies API Function

**Files:**
- Modify: `frontend/src/repositories/api.ts`

**Step 1: Add the API function**

Add this function to the api.ts file (find the proxy-related functions section):

```typescript
export async function bulkImportProxies(proxies: string): Promise<{
  created: number
  updated: number
  skipped: number
  errors: Array<{ line: number, raw: string, error: string }>
}> {
  const response = await axios.post('/api/proxies/bulk-import', { proxies })
  return response.data
}
```

**Step 2: Commit the API function**

```bash
git add frontend/src/repositories/api.ts
git commit -m "feat: add bulkImportProxies API function"
```

---

## Task 3: Modify ProxiesPage - Remove Create Form

**Files:**
- Modify: `frontend/src/pages/ProxiesPage.vue`

**Step 1: Remove form-related state and computed**

Remove these lines:
- Line ~20: `const editingId = ref<number | null>(null)`
- Line ~21-26: `const form = ref<ProxyForm>({ ... })`
- Line ~28: `const isEditing = computed(() => editingId.value !== null)`

**Step 2: Remove form-related functions**

Remove these functions:
- `resetForm()` (lines ~30-33)
- `startEdit()` (lines ~35-43)
- `normalizeOptional()` (lines ~45-48)
- `submit()` (lines ~62-92)

**Step 3: Update imports**

Remove `ProxyForm` type from imports on line ~6:
```typescript
// Remove this line:
type ProxyForm = {
  server: string
  username: string
  password: string
  status: 'ACTIVE' | 'INACTIVE'
}
```

**Step 4: Update remove function**

Modify the `remove()` function to remove the `editingId` check:

```typescript
async function remove(proxy: Proxy) {
  const confirmed = confirm(`Delete proxy "${proxy.server}"?`)
  if (!confirmed) return

  error.value = null
  try {
    await api.deleteProxy(proxy.id)
    await fetchProxies()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to delete proxy'
  }
}
```

**Step 5: Remove the entire form section from template**

Remove lines ~155-224 (the entire form div with class "rounded-lg border bg-card" that contains the edit/create form).

**Step 6: Commit ProxiesPage form removal**

```bash
git add frontend/src/pages/ProxiesPage.vue
git commit -m "refactor: remove single proxy creation form from ProxiesPage"
```

---

## Task 4: Modify ProxiesPage - Add Bulk Import

**Files:**
- Modify: `frontend/src/pages/ProxiesPage.vue`

**Step 1: Add BulkImportModal import**

Add at top of script section:
```typescript
import BulkImportModal from '@/parts/HomePage/BulkImportModal.vue'
```

**Step 2: Add modal state**

Add after the other ref declarations:
```typescript
const showBulkImport = ref(false)
```

**Step 3: Add openBulkImport function**

```typescript
function openBulkImport() {
  showBulkImport.value = true
}
```

**Step 4: Add BulkImportModal to template**

Add before the closing `</template>` tag:
```vue
<BulkImportModal v-model="showBulkImport" @imported="fetchProxies" />
```

**Step 5: Add "Bulk Import" button**

Add in the header section, next to "Rotate" and "Refresh" buttons:
```vue
<button class="rounded-md border px-3 py-2 text-sm" :disabled="loading" @click="openBulkImport">
  Bulk Import
</button>
```

**Step 6: Commit ProxiesPage bulk import addition**

```bash
git add frontend/src/pages/ProxiesPage.vue
git commit -m "feat: add bulk import button and modal to ProxiesPage"
```

---

## Task 5: Remove Backend Create Endpoint

**Files:**
- Modify: `infrastructure/http/ProxyController.ts`
- Modify: `infrastructure/http/routes.ts`

**Step 1: Remove create method from ProxyController**

Delete the `create()` method (lines ~53-76) from `infrastructure/http/ProxyController.ts`.

**Step 2: Remove create route**

Remove this line from `infrastructure/http/routes.ts`:
```typescript
router.post('/proxies/create', proxiesApi('create'))
```

**Step 3: Commit backend create removal**

```bash
git add infrastructure/http/ProxyController.ts infrastructure/http/routes.ts
git commit -m "refactor: remove single proxy create endpoint

Use bulk import endpoint instead for adding new proxies.
Update endpoint remains for editing existing proxies."
```

---

## Task 6: Test the Implementation

**Files:**
- Test: Manual testing in browser

**Step 1: Start the application**

```bash
npm run dev
```

Expected: Backend starts on port 3000 (or configured PORT)

**Step 2: Start the frontend (in separate terminal)**

```bash
cd frontend && npm run dev
```

Expected: Frontend starts on port 5173 (Vite default)

**Step 3: Navigate to Proxies page**

Open browser to `http://localhost:5173` and navigate to Proxies page.

Expected:
- No "Add proxy" form visible
- "Bulk Import" button present next to "Rotate" and "Refresh"
- Existing proxy table with Edit/Delete/Test buttons

**Step 4: Test bulk import modal**

Click "Bulk Import" button.

Expected:
- Modal opens with title "Bulk Import Proxies"
- Textarea visible with placeholder
- Format instructions shown
- "Import" and "Cancel" buttons present

**Step 5: Test invalid input**

Enter invalid text and click "Import".

Expected: Error message shown, modal stays open

**Step 6: Test valid import**

Enter valid proxy format and click "Import":
```
103.49.63.100:2649:testuser:testpass
```

Expected:
- "Importing..." shown on button
- Result summary displayed (created/skipped counts)
- Modal auto-closes after 2 seconds
- Proxy list refreshes

**Step 7: Test cancel button**

Open modal and click "Cancel".

Expected: Modal closes immediately

**Step 8: Test existing functionality**

Verify Edit and Delete buttons still work for existing proxies.

Expected:
- Edit button allows modifying proxy
- Delete button removes proxy with confirmation
- Test button tests proxy connection

**Step 9: Commit any fixes if needed**

If any issues were found and fixed:

```bash
git add .
git commit -m "fix: resolve bulk import UI issues found during testing"
```

---

## Completion Checklist

- [ ] BulkImportModal.vue created with full functionality
- [ ] bulkImportProxies API function added
- [ ] ProxiesPage form section removed
- [ ] ProxiesPage bulk import button and modal added
- [ ] Backend create endpoint removed
- [ ] Manual testing completed successfully
- [ ] All commits pushed to remote

---

## Notes

- The backend `/api/proxies/bulk-import` endpoint already exists and expects format `ip:port:username:password`
- Edit functionality uses the existing `/api/proxies/update` endpoint which we kept
- The modal uses a simple backdrop div - could be upgraded to Reka UI Dialog component later if needed
- Auto-close after 2 seconds provides feedback without requiring manual close
