# Remove Frontend Rotate Button - Design Document

**Date:** 2026-02-06
**Status:** Approved
**Risk Level:** Low

## Overview

Remove the non-functional "Rotate" button from the ProxiesPage frontend while preserving the backend `rotate()` method that is critical for the credential verification system.

## Problem Statement

The ProxiesPage contains a "Rotate" button that:
- Calls `api.rotateProxy()` → POST `/api/proxies/rotate`
- The HTTP endpoint does not exist in routes.ts (button is broken)
- Creates confusion with an unused UI element

However, the `rotate()` repository method IS used by `PlaywrightVerify.ts` to automatically cycle through proxies during credential verification. This internal functionality must be preserved.

## Solution

Remove frontend-only code while keeping backend rotate functionality intact.

## Changes Required

### Frontend: ProxiesPage.vue

**Remove from `<script setup>`:**
- Line 10: `const rotating = ref(false)`
- Lines 57-69: `async function rotate()`

**Remove from `<template>`:**
- Lines 112-114: The Rotate button element

### Frontend: api.ts

**Remove function:**
- Lines 120-123: `export async function rotateProxy()`

### Preserve (No Changes)

- `core/repositories/IProxyRepository.ts` - Keep `rotate()` interface method
- `infrastructure/db/prisma/repositories/PrismaProxyRepository.ts` - Keep implementation
- `infrastructure/verifier/PlaywrightVerify.ts` - Keep internal usage

## Testing & Verification

### Manual Testing Steps

1. Start application: `npm run dev` and `cd frontend && npm run dev`
2. Navigate to Proxies page
3. Verify Rotate button is not visible
4. Verify remaining buttons work: Bulk Import, Delete All, Refresh
5. Verify credential verification still rotates proxies automatically

### Risk Assessment

**Risk Level: Low**
- Removing unused frontend code only
- Backend functionality preserved
- No API contract changes
- No database migrations required

## Implementation

See implementation plan for detailed steps.
