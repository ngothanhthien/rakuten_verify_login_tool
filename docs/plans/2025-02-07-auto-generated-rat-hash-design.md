# Auto-Generated Hash for Custom RAT System

**Date:** 2025-02-07
**Status:** Design Approved

## Overview

Simplify the Custom RAT creation flow by auto-generating the hash from the components JSON. Users only need to provide the components; the hash is computed server-side using SHA256.

## Problem Statement

Currently, users must manually provide both `hash` and `components` when creating a RAT. This is redundant because the hash is derived from the components. Users may also enter mismatched hash/components pairs.

## Solution

Remove `hash` from the API request. Auto-generate hash from components using SHA256(JSON.stringify(components)). Use upsert for idempotent behavior.

## Changes

### 1. New Utility: `utils/generateRatHash.ts`

```typescript
import { createHash } from 'crypto';

export function generateRatHash(components: any): string {
  const normalized = JSON.stringify(components, Object.keys(components).sort());
  return createHash('sha256')
    .update(normalized)
    .digest('hex');
}
```

**Decisions:**
- Full 32-character SHA256 hex (not truncated)
- Sort object keys for consistent hash regardless of key order

### 2. Backend API Changes

**`POST /api/rats`** - Updated signature
- **Before:** `{ hash: string, components: object }`
- **After:** `{ components: object }`
- **Returns:** Created or updated `CustomRat` with auto-generated hash
- **Behavior:** Idempotent via upsert (creates new or updates existing)

**Controller Changes:**
```typescript
async addRat(req: Request, res: Response): Promise<void> {
  const { components } = req.body;
  const hash = generateRatHash(components);
  const rat = await this._customRatRepository.upsert(hash, components);
  res.status(200).json(rat);
}
```

**Repository Addition:**
```typescript
// ICustomRatRepository interface
upsert(hash: string, components: any): Promise<CustomRat>;

// PrismaCustomRatRepository implementation
async upsert(hash: string, components: any): Promise<CustomRat> {
  return await this._prisma.customRat.upsert({
    where: { hash },
    update: {
      components: JSON.stringify(components),
      status: 'ACTIVE',
      failureCount: 0
    },
    create: {
      hash,
      components: JSON.stringify(components),
      status: 'ACTIVE',
      failureCount: 0
    }
  });
}
```

### 3. Frontend Changes

**`frontend/src/repositories/api.ts`:**
```typescript
// Before: addRat(hash: string, components: Record<string, any>)
// After:  addRat(components: Record<string, any>)
```

**`frontend/src/pages/RatsPage.vue`:**
- Remove `newHash` state variable
- Remove hash input field from form
- Simplify `canSubmit` to only check JSON validity
- Update `addRat()` to only pass components

### 4. Validation

- **Invalid JSON:** Frontend validates before submit
- **Payload size:** 100KB limit on components JSON
- **Duplicate hash:** Upsert automatically handles (updates existing)

## API Documentation

```markdown
**POST /api/rats** - Add new RAT (hash auto-generated)
- Body: `{ components: object }`
- Returns: Created or updated `CustomRat` object
- Hash format: 32-character SHA256 hex
- Idempotent: Same components update existing RAT
```

## File Changes Summary

| File | Action |
|------|--------|
| `utils/generateRatHash.ts` | NEW |
| `core/repositories/ICustomRatRepository.ts` | ADD `upsert()` |
| `infrastructure/db/prisma/repositories/PrismaCustomRatRepository.ts` | IMPLEMENT `upsert()` |
| `infrastructure/http/controllers/CustomRatController.ts` | UPDATE `addRat()` |
| `frontend/src/repositories/api.ts` | UPDATE `addRat()` |
| `frontend/src/pages/RatsPage.vue` | REMOVE hash field |
| `scripts/insert-test-rat.ts` | UPDATE use `generateRatHash` |
| `CLAUDE.md` | UPDATE API docs |
