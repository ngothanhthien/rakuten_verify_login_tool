# Quick Start Guide - Packaging & Running

## 1. Project Type
**Node.js/TypeScript Full-Stack Application**
- Backend: Express.js + WebSocket + Prisma + Playwright
- Frontend: Vue 3 + Vite (pre-built)
- Database: SQLite

---

## 2. Quick Start (3 Commands)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Run the application
npm start
```

Server runs at: `http://localhost:3000`

---

## 3. Available Commands

### Development
```bash
npm run start:dev          # Run with live TypeScript (no compilation)
npm run prisma:studio      # Open database GUI
```

### Production Build
```bash
npm run build             # Build everything (frontend + backend)
npm start                 # Run production build
```

### Database
```bash
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate    # Apply migrations (production)
npm run prisma:migrate:dev # Create new migration (dev)
```

---

## 4. Distribution Options

### A. Standard Deployment (Server/VPS)
```bash
# Build once
npm run build

# Deploy to server (copy these)
- dist/                # Compiled backend
- frontend-dist/       # Built frontend
- infrastructure/      # Database schema & migrations
- node_modules/        # Dependencies
- package.json
- .env                 # Your configuration

# On server
npm start
```

### B. Using Process Manager (Recommended)
```bash
npm install -g pm2
pm2 start npm --name "rakuten" -- start
pm2 save
pm2 startup
```

### C. Using Startup Script
```bash
./start.sh             # Automated checks + startup
```

### D. Docker Container
```bash
docker build -t rakuten-app .
docker run -p 3000:3000 --env-file .env rakuten-app
```

### E. Standalone Binary
```bash
# Install bun
curl -fsSL https://bun.sh/install | bash

# Build single executable
bun build ./dist/main.js --compile --outfile rakuten-app

# Run
./rakuten-app
```

---

## 5. Environment Setup

Edit `.env` with required values:

```env
PORT=3000
DATABASE_URL="file:./dev.db"
CREDENTIAL_CHECK_CONCURRENCY=3
TELEGRAM_BOT_TOKEN=your_token      # Optional
TELEGRAM_CHAT_ID=your_chat_id      # Optional
```

See `.env.example` for all options.

---

## 6. First Run Checklist

- [ ] `npm install` completed
- [ ] `.env` file created and configured
- [ ] Prisma client generated (auto-runs with npm install)
- [ ] Database migrations applied (auto-runs with npm start)
- [ ] Server starts without errors
- [ ] Can access `http://localhost:3000`

---

## 7. Troubleshooting

**Problem**: Prisma client not found
```bash
npm run prisma:generate
```

**Problem**: Playwright browser missing
```bash
npx patchright install chromium
```

**Problem**: Database locked/permission error
```bash
chmod 664 dev.db
```

**Problem**: Frontend not loading
```bash
cd frontend && npm install && npm run build
```

---

## 8. Architecture Summary

```
main.ts (entry point)
    ↓
container.ts (dependency injection)
    ↓
express.ts (HTTP server + routes)
    ↓
Controllers → Use Cases → Repositories → Database
```

**Key Components:**
- `main.ts:6` - Bootstrap function (entry point)
- `container.ts:9` - buildContainer() (DI setup)
- `infrastructure/http/express.ts` - HTTP server setup
- `infrastructure/db/prisma/` - Database layer

---

## 9. Production Deployment Workflow

```bash
# On development machine
git pull
npm install
npm run build
npm test  # if you have tests

# Transfer to production
scp -r dist/ frontend-dist/ package.json .env user@server:/app/

# On production server
cd /app
npm install --production
npm start

# Or with PM2
pm2 restart rakuten
```

---

## 10. Monitoring

```bash
# View logs (PM2)
pm2 logs rakuten

# View logs (systemd)
journalctl -u rakuten -f

# Health check
curl http://localhost:3000/health
```

---

For complete documentation, see: **DEPLOYMENT.md**
