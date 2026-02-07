# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript monorepo application for automated credential checking with a Vue.js frontend. It follows Clean Architecture (Hexagonal Architecture) principles with dependency injection using Awilix.

**Key Domain**: Automated Rakuten credential verification using worker-based parallel processing with proxy rotation.

## Commands

### Development
- `npm run dev` or `npm start` - Run backend directly with `tsx` (no compilation needed)
- `cd frontend && npm run dev` - Run frontend dev server with Vite

### Building
- `npm run build` - Full build: frontend + backend + Prisma client generation
- `npm run build:backend` - Compile TypeScript to `dist/`, then run `./fix-esm-imports.sh`
- `npm run build:frontend` - Build Vue frontend to `frontend-dist/`
- `npm run build:standalone` - Package standalone Windows bundle to `dist-windows/`

### Database (Prisma)
- `npm run prisma:generate` - Generate Prisma client from schema (outputs to `node_modules/.prisma/client`)
- `npm run prisma:migrate` - Deploy migrations to database
- `npm run prisma:migrate:dev` - Create and apply new migration
- `npm run prisma:studio` - Open Prisma Studio for database inspection
- `npm run prisma:seed` - Seed database

### Windows Packaging
- `npm run package:windows` - Build for Windows (includes frontend, generates zip)

### Frontend Development
- `cd frontend && npm run type-check` - Run Vue TypeScript compiler check
- `cd frontend && npm run build-only` - Build without type check
- `cd frontend && npm run preview` - Preview production build

## Architecture

### Clean Architecture Layers

```
rakuten/
├── main.ts                 # Application entry point, bootstraps container
├── container.ts            # Awilix DI container registration
├── core/                   # Domain layer (entities, value objects, repository interfaces)
├── application/            # Application layer (use cases, services, ports)
├── infrastructure/         # Infrastructure layer (DB, HTTP, external services)
├── frontend/               # Vue 3 + Vite frontend
├── utils/                  # Utility functions (RAT override, GPU spoofing)
└── types/                  # Shared type definitions
```

### Core Layer (Domain)
- `entities/` - Domain entities (Credential, Proxy, Setting, ControlState)
- `value-objects/` - Value objects (CredentialStatus, PaginateQuery, WorkerProxyAssignment, WorkerContext, etc.)
- `repositories/` - Repository interfaces (ICredentialRepository, ISettingRepository, IProxyRepository)

### Application Layer
- `use-cases/` - Business logic use cases (ImportCredentials, ScanCredentials, ExportCredentials, DeleteUncheckedCredentials, BulkImportProxies)
- `services/` - Application services (CredentialCheckRunner, SettingService)
- `ports/` - Interface definitions (ICredentialSource, IUiNotifier, IVerifyService)

### Infrastructure Layer
- `db/prisma/` - Prisma ORM setup with SQLite (repositories: PrismaCredentialRepository, etc.)
- `http/` - Express.js REST API (controllers, routes)
- `notifier/` - Notifications (TelegramNotifier, WebsocketNotifier)
- `verifier/` - Playwright-based credential verification service using Patchright
- `CredentialImportSource/` - File-based credential import

### Frontend
- Vue 3 with Composition API and TypeScript
- Vite for build tooling
- Tailwind CSS v4 for styling
- Reka UI component library
- Vue Router for navigation
- **Node Engine Requirement**: `^20.19.0 || >=22.12.0`

### Key Concepts

**Dependency Injection**: All dependencies are registered in `container.ts` using Awilix. The container uses scoped lifetimes for repositories and singletons for services.

**CredentialCheckRunner**: The core background service that manages parallel workers for credential checking. Each worker is assigned 2 proxies and round-robins between them. Workers terminate automatically when both assigned proxies die. Configured via environment variables:
- `CREDENTIAL_CHECK_CONCURRENCY` - Number of concurrent workers (default: 40, 1 in debug mode)
- `CREDENTIAL_CHECK_BATCH_SIZE` - Batch size for processing (default: 3)
- `CREDENTIAL_CHECK_POLLING_INTERVAL_MS` - Polling interval when no credentials to process (default: 1000ms)
- `CREDENTIAL_CHECK_STALE_TIMEOUT_MINUTES` - Timeout for releasing stale claims (default: 10 minutes)
- `AUTOMATE_DEBUG` - Set to 'true' to reduce concurrency to 1 for debugging

**Proxy Worker Model**: Each worker gets exactly 2 proxies assigned at startup. Workers round-robin between their assigned proxies and terminate when both die. This requires minimum 2 proxies, with recommended `CONCURRENCY * 2` proxies for optimal coverage.

**Verification Service**: PlaywrightVerify uses Patchright (Playwright fork) to automate browser interactions for credential verification.

**Custom RAT**: A custom Rakuten Account Transfer (RAT) hash is loaded from a remote Gist at startup (see `container.ts`) to override GPU fingerprinting detection via `utils/ratOverride.ts`.

**WebSocket**: Real-time updates are pushed to connected frontend clients via WebSocket server created in `main.ts`.

## TypeScript Configuration

- `target: ES2020`, `module: ESNext`
- `tsx` runs TypeScript directly in development (no compilation needed)
- Compiled output goes to `dist/` (for production deployment)
- `./fix-esm-imports.sh` post-build script handles ESM import fixes
- Frontend has separate TypeScript config in `frontend/`

## Environment Variables

See `.env.example` for required variables. Key ones:
- `DATABASE_URL` - SQLite database path (e.g., `file:./dev.db`)
- `PORT` - HTTP server port (default: 3000)
- `AUTOMATE_DEBUG` - Enable debug mode (reduces concurrency to 1)

## Database Schema

**Prisma with SQLite** - Schema defined in `infrastructure/db/prisma/schema.prisma`:

- `Credential` - id, email, password, status, checkedAt, processingBy, claimedAt
- `Setting` - key, name, value, type, group (application settings)
- `Proxy` - server, username, password, status, country (proxy pool)

The Prisma client is generated to `node_modules/.prisma/client` and supports both native and Windows binary targets.
