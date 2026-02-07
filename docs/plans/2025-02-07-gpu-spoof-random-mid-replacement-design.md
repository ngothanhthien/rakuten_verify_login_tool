# GPU Spoof Random Mid-Position String Replacement

**Date**: 2025-02-07
**Status**: Approved
**File**: `utils/gpuSpoof.ts`

## Overview

Replace the fixed "Bionic" string replacement with a dynamic approach that replaces **any 6 consecutive characters** at a random mid-position in the renderer string with a random 6-character string.

## Problem

Current implementation only replaces "Bionic" when present:
```typescript
if (spec.renderer.includes('Bionic')) {
  spec.renderer = spec.renderer.replace('Bionic', randomString());
}
```

This is too predictable and doesn't vary the position of the spoofed string.

## Solution

Replace 6 characters at a **random mid-position** regardless of what the original text is.

### Algorithm

1. If string length >= 26:
   - Skip first 10 characters (protect "Apple GPU" prefix)
   - Skip last 10 characters (protect ending like "GPU", ")")
   - Pick random start index within `[10, length - 16]`
   - Replace 6 chars from that index

2. If string length < 26 (but >= 6):
   - Replace from middle: `floor((length - 6) / 2)`

3. If string length < 6:
   - Return unchanged (not enough room)

## Implementation

### New Function: `replaceMidRandom`

```typescript
/**
 * Replace 6 characters at a random mid-position with random string
 * @param str - Input string to modify
 * @returns Modified string with 6 chars replaced
 */
function replaceMidRandom(str: string): string {
  if (str.length < 6) return str;

  if (str.length >= 26) {
    // Safe range: skip first 10, skip last 10
    const maxStart = str.length - 16;
    const startIdx = 10 + Math.floor(Math.random() * (maxStart - 10));
    return str.slice(0, startIdx) + randomString() + str.slice(startIdx + 6);
  } else {
    // Shorter string: replace from middle
    const startIdx = Math.floor((str.length - 6) / 2);
    return str.slice(0, startIdx) + randomString() + str.slice(startIdx + 6);
  }
}
```

### Changes to `createGPUSpoofScript`

**Remove** (lines 178-183):
```typescript
if (spec.renderer.includes('Bionic')) {
  spec = {
    ...spec,
    renderer: spec.renderer.replace('Bionic', randomString())
  };
}
```

**Replace with**:
```typescript
if (spec.renderer) {
  spec = { ...spec, renderer: replaceMidRandom(spec.renderer) };
}
```

## Testing

- Short strings (< 6 chars) return unchanged
- Exactly 6 chars replaced entirely
- 26+ chars avoid first 10 and last 10 positions
- Multiple calls produce different results
