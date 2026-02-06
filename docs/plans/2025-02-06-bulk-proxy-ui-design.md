# Bulk Proxy Import UI Design

**Date:** 2025-02-06
**Status:** Design Approved

## Overview

Add UI for bulk proxy import functionality. Remove single proxy creation form and API endpoint, keeping only bulk import for adding new proxies. Edit and delete functionality remains for existing proxies.

## Changes Summary

**Remove:**
- Single proxy creation form from ProxiesPage
- `POST /api/proxies/create` endpoint

**Add:**
- Bulk import modal component
- "Bulk Import" button on proxies page
- API client function for bulk import

**Keep:**
- Edit/Delete/Test buttons for existing proxies
- `POST /api/proxies/update` endpoint for edit functionality

## UI Components

### BulkImportModal.vue

**Location:** `frontend/src/parts/HomePage/BulkImportModal.vue`

**Props:**
- `modelValue: boolean` - Modal visibility (v-model)

**Emits:**
- `update:modelValue` - Close modal
- `imported` - Import completed, triggers refresh

**State:**
- `text: string` - Multiline proxy input
- `importing: boolean` - Loading state
- `result: ImportResult | null` - Import summary
- `error: string | null` - Error message

**Layout:**
```
┌─────────────────────────────────────┐
│ Bulk Import Proxies           [X]   │
├─────────────────────────────────────┤
│                                      │
│ Format: ip:port:username:password   │
│ (one proxy per line)                │
│                                      │
│ ┌────────────────────────────────┐  │
│ │  [Large textarea]              │  │
│ └────────────────────────────────┘  │
│                                      │
│ Example:                             │
│ 103.49.63.100:2649:user1:pass1      │
│ 103.49.63.100:2176:user2:pass2      │
│                                      │
│ [Import]                    [Cancel] │
└─────────────────────────────────────┘
```

### ProxiesPage.vue Modifications

**Remove:**
- Entire "Add proxy" form section
- `editingId` state and `isEditing` computed
- Form functions: `resetForm()`, `startEdit()`, `submit()`

**Add:**
- "Bulk Import" button next to "Rotate" and "Refresh"
- Import of `BulkImportModal.vue`
- Modal state and handlers

## API Changes

### Frontend: `frontend/src/repositories/api.ts`

Add function:
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

### Backend: Remove Single Create

**Remove from `ProxyController.ts`:**
- `create()` method (lines 53-76)

**Remove from `routes.ts`:**
- `router.post('/proxies/create', ...)` route

**Keep:**
- `update()` method for edit functionality

## Data Flow

```
User clicks "Bulk Import"
       ↓
Modal opens
       ↓
User pastes proxy list (ip:port:user:pass)
       ↓
User clicks "Import"
       ↓
POST /api/proxies/bulk-import
       ↓
Backend processes each line:
  - Parse format
  - Test connection (3 retries, <2000ms)
  - Create or update if pass
  - Skip if fail
       ↓
Return summary { created, updated, skipped, errors }
       ↓
Show result in modal
       ↓
Close modal after 2 seconds
       ↓
Emit 'imported' event
       ↓
ProxiesPage refreshes list
```

## Files to Create/Modify

**Create:**
1. `frontend/src/parts/HomePage/BulkImportModal.vue`

**Modify:**
2. `frontend/src/pages/ProxiesPage.vue`
3. `frontend/src/repositories/api.ts`
4. `infrastructure/http/ProxyController.ts`
5. `infrastructure/http/routes.ts`
