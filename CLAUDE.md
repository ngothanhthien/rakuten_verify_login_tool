# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript monorepo application for automated credential checking with a Vue.js frontend. It follows Clean Architecture (Hexagonal Architecture) principles with dependency injection using Awilix.

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
- `npm run prisma:generate` - Generate Prisma client from schema
- `npm run prisma:migrate` - Deploy migrations to database
- `npm run prisma:migrate:dev` - Create and apply new migration
- `npm run prisma:studio` - Open Prisma Studio for database inspection
- `npm run prisma:seed` - Seed database

### Windows Packaging
- `npm run package:windows` - Build for Windows (includes frontend, generates zip)

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
- `value-objects/` - Value objects (CredentialStatus, PaginateQuery, etc.)
- `repositories/` - Repository interfaces (ICredentialRepository, ISettingRepository, IProxyRepository)

### Application Layer
- `use-cases/` - Business logic use cases (ImportCredentials, ScanCredentials, ExportCredentials, DeleteUncheckedCredentials)
- `services/` - Application services (CredentialCheckRunner, SettingService)
- `ports/` - Interface definitions (ICredentialSource, IUiNotifier, IVerifyService)

### Infrastructure Layer
- `db/prisma/` - Prisma ORM setup (repositories: PrismaCredentialRepository, etc.)
- `http/` - Express.js REST API (controllers, routes)
- `notifier/` - Notifications (TelegramNotifier, WebsocketNotifier)
- `verifier/` - Playwright-based credential verification service
- `CredentialImportSource/` - File-based credential import

### Frontend
- Vue 3 with Composition API and TypeScript
- Vite for build tooling
- Tailwind CSS v4 for styling
- Reka UI component library
- Vue Router for navigation

### Key Concepts

**Dependency Injection**: All dependencies are registered in `container.ts` using Awilix. The container uses scoped lifetimes for repositories and singletons for services.

**CredentialCheckRunner**: The core background service that polls for credentials to check. Configured via environment variables:
- `CREDENTIAL_CHECK_CONCURRENCY` - Number of concurrent checks
- `CREDENTIAL_CHECK_BATCH_SIZE` - Batch size for processing
- `CREDENTIAL_CHECK_POLLING_INTERVAL_MS` - Polling interval
- `CREDENTIAL_CHECK_STALE_TIMEOUT_MINUTES` - Timeout for stale claims

**Verification Service**: PlaywrightVerify uses Patchright (Playwright fork) to automate browser interactions for credential verification.

**Custom RAT**: A custom Rakuten Account Transfer (RAT) hash is loaded from a remote Gist at startup to override GPU fingerprinting detection.

**WebSocket**: Real-time updates are pushed to connected frontend clients via WebSocket.

## TypeScript Configuration

- `target: ES2020`, `module: ESNext`
- `tsx` runs TypeScript directly in development
- Compiled output goes to `dist/` (for production deployment)
- Frontend has separate TypeScript config in `frontend/`

## Environment Variables

See `.env.example` for required variables. Key ones:
- `DATABASE_URL` - SQLite database path
- `PORT` - HTTP server port
- `AUTOMATE_DEBUG` - Enable debug mode (reduces concurrency)
