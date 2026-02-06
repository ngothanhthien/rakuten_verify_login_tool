# Proxy Country Detection Design

## Overview
Automatically detect and store the country of origin for proxies during import, enabling users to see where their proxies are located.

## Requirements
- Detect proxy country automatically during bulk import
- Handle third-party API rate limits and blocking
- Display country with flag emoji in frontend
- Graceful degradation when detection fails

## Architecture

### Database Schema Changes

```prisma
model Proxy {
  id Int @id @default(autoincrement())
  server String
  username String?
  password String?
  status String @default("ACTIVE")
  country String?           // ISO 3166-1 alpha-2 code (e.g., "US", "JP")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Geolocation Strategy

**Fallback Chain:**
1. `https://country.is` - Free Cloudflare Workers API, no auth
2. `https://ipapi.co/json/` - 1000 requests/day free
3. `geoip-lite` - Local database, offline fallback

**Rate Limiting:**
- 1 request per second between country lookups
- Cache results by proxy server address
- Fail gracefully if all methods exhausted

### Data Flow

```
Proxy Import
    ↓
Test Connection (testProxyWithRetry)
    ↓
Fetch Country (country.is → ipapi.co → geoip-lite)
    ↓
Save to DB with country code
    ↓
Display in UI with flag emoji
```

## Implementation Changes

### Files to Modify

1. **infrastructure/db/prisma/schema.prisma**
   - Add `country String?` field to Proxy model

2. **core/entities/Proxy.ts**
   - Add `country` to ProxyProps interface
   - Add getter method

3. **core/repositories/IProxyRepository.ts**
   - Update CreateProxyData interface: `country?: string | null`

4. **infrastructure/db/prisma/repositories/PrismaProxyRepository.ts**
   - Update create/update methods to handle country field

5. **infrastructure/geoip/CountryLookup.ts** (NEW)
   - Implement fallback chain for country detection
   - Handle rate limiting and errors

6. **infrastructure/http/testHttpProxyConnect.ts**
   - Optionally fetch country after successful test
   - Return country in test result

7. **application/use-cases/BulkImportProxies.ts**
   - Save detected country when creating/updating proxies
   - Implement rate limiting between lookups

8. **frontend/src/pages/ProxiesPage.vue**
   - Add country column with flag emoji display
   - Handle null/unknown countries

9. **frontend/src/repositories/api.ts**
   - Update Proxy type to include `country?: string | null`

### Dependencies

```bash
npm install geoip-lite
npm install --save-dev @types/geoip-lite
```

## Migration

```bash
npx prisma migrate dev --add_proxy_country
```

## Frontend Display

Country column displays:
- Flag emoji + ISO code (e.g., "🇺🇸 US")
- "Unknown" for null countries

```typescript
function getCountryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, char =>
      String.fromCodePoint(0x1F1A5 + char.charCodeAt(0))
    );
}
```

## Error Handling

- API blocked → Try next fallback
- Rate limited → Wait and retry or skip
- All fail → Import proxy without country (null)
- Log warnings for debugging

## Future Considerations

- Manual country override/edit in UI
- Country filtering in proxy list
- Group by country view
- Proxy performance metrics by country
