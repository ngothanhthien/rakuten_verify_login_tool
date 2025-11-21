# Deployment Guide

## Project Overview

This is a **Node.js/TypeScript full-stack application** consisting of:
- **Backend**: Express.js REST API with WebSocket support
- **Frontend**: Vue 3 + Vite SPA (Single Page Application)
- **Database**: SQLite with Prisma ORM
- **Automation**: Playwright for credential verification

---

## Prerequisites

- **Node.js**: v20.19.0 or v22.12.0+ (as specified in frontend/package.json)
- **npm** or **bun**: Package manager
- **Git**: For version control

---

## Packaging Options

### Option 1: Production Build (Recommended)

This creates compiled JavaScript files optimized for production deployment.

#### Steps:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

3. **Build the Application**
   ```bash
   npm run build
   ```
   
   This will:
   - Build the Vue frontend (outputs to `frontend-dist/`)
   - Compile TypeScript backend to JavaScript (outputs to `dist/`)
   - Generate Prisma client

4. **Initialize Database**
   ```bash
   npm run prisma:migrate
   ```

5. **Start Production Server**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

---

### Option 2: Development Mode (Quick Start)

Runs TypeScript directly without compilation (faster for development).

```bash
npm install
cp .env.example .env
# Edit .env as needed
npm run start:dev
```

---

## Distribution Formats

### 1. Standard Node.js Deployment

**Use case**: VPS, dedicated server, cloud VM

**Package contents**:
```
rakuten/
├── dist/                 # Compiled backend JavaScript
├── frontend-dist/        # Built frontend static files
├── infrastructure/db/prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── generated/        # Prisma client
├── node_modules/
├── package.json
├── .env                  # Your configuration
└── dev.db               # SQLite database (created at runtime)
```

**Deployment steps**:
1. Copy entire project directory to server
2. Set environment variables in `.env`
3. Run `npm install --production`
4. Run `npm start`

**Or use a process manager**:
```bash
# Using PM2
npm install -g pm2
pm2 start npm --name "rakuten" -- start
pm2 save
pm2 startup
```

---

### 2. Docker Container (Containerized)

Create a `Dockerfile`:

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t rakuten-app .
docker run -p 3000:3000 --env-file .env rakuten-app
```

---

### 3. Standalone Executable (Single Binary)

For distributing as a single executable file using **pkg** or **bun build**:

#### Using Bun (Recommended - Simpler)

```bash
# Install bun if not already installed
curl -fsSL https://bun.sh/install | bash

# Build standalone executable
bun build ./dist/main.js --compile --outfile rakuten-app

# This creates a single binary: ./rakuten-app
```

#### Using pkg (Alternative)

```bash
npm install -g pkg

# Add to package.json:
"bin": "dist/main.js",
"pkg": {
  "assets": [
    "infrastructure/db/prisma/schema.prisma",
    "infrastructure/db/prisma/migrations/**/*",
    "frontend-dist/**/*"
  ]
}

# Build executables
pkg . --targets node22-linux-x64,node22-macos-x64,node22-win-x64
```

**Note**: Standalone executables still require:
- SQLite database file (created at runtime)
- `.env` file or environment variables
- Chromium/Playwright dependencies for automation

---

## Environment Configuration

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | SQLite file path | `file:./dev.db` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CREDENTIAL_CHECK_CONCURRENCY` | Parallel verification workers | `3` |
| `CREDENTIAL_CHECK_BATCH_SIZE` | Credentials per batch | `3` |
| `CREDENTIAL_CHECK_POLLING_INTERVAL_MS` | Polling frequency | `1000` |
| `CREDENTIAL_CHECK_STALE_TIMEOUT_MINUTES` | Stale claim timeout | `10` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for notifications | - |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | - |
| `HEADLESS` | Run Playwright in headless mode | `true` |

---

## Database Management

### Migrations

```bash
# Apply migrations (production)
npm run prisma:migrate

# Create new migration (development)
npm run prisma:migrate:dev

# Open Prisma Studio (GUI)
npm run prisma:studio
```

### Backup Database

```bash
# SQLite backup
cp dev.db dev.db.backup-$(date +%Y%m%d)
```

---

## File Structure After Build

```
rakuten/
├── dist/                          # Compiled backend (from TypeScript)
│   ├── main.js
│   ├── container.js
│   ├── application/
│   ├── core/
│   └── infrastructure/
├── frontend-dist/                 # Built frontend (static files)
│   ├── index.html
│   └── assets/
├── infrastructure/db/prisma/
│   ├── schema.prisma             # Database schema
│   ├── migrations/               # Migration history
│   └── generated/                # Prisma client (auto-generated)
├── node_modules/                 # Dependencies
├── package.json
├── .env                          # Configuration
└── dev.db                        # SQLite database (runtime)
```

---

## Running in Production

### Option A: Direct Node.js

```bash
NODE_ENV=production npm start
```

### Option B: PM2 Process Manager

```bash
pm2 start npm --name "rakuten" -- start
pm2 logs rakuten       # View logs
pm2 restart rakuten    # Restart
pm2 stop rakuten       # Stop
```

### Option C: Systemd Service (Linux)

Create `/etc/systemd/system/rakuten.service`:

```ini
[Unit]
Description=Rakuten Application
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/rakuten
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/rakuten/.env
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable rakuten
sudo systemctl start rakuten
sudo systemctl status rakuten
```

---

## Troubleshooting

### Prisma Client Not Found

```bash
npm run prisma:generate
```

### Playwright Browser Not Installed

```bash
npx patchright install chromium
```

### Permission Errors on SQLite Database

```bash
chmod 664 dev.db
chmod 775 $(dirname dev.db)
```

### Frontend Not Loading

Check that `frontend-dist/` directory exists and contains `index.html`:
```bash
ls -la frontend-dist/
```

If missing, rebuild frontend:
```bash
cd frontend && npm install && npm run build
```

---

## Security Recommendations

1. **Environment Variables**: Never commit `.env` to version control
2. **Database**: Backup regularly, restrict file permissions
3. **Dependencies**: Run `npm audit` and update regularly
4. **Firewall**: Only expose port 3000 (or use reverse proxy)
5. **HTTPS**: Use nginx or Caddy as reverse proxy with SSL
6. **Credentials**: Store sensitive data encrypted

---

## Monitoring

### Logs

```bash
# PM2
pm2 logs rakuten

# Systemd
journalctl -u rakuten -f

# Docker
docker logs -f <container-id>
```

### Health Check Endpoint

Add to your infrastructure/http/routes.ts:
```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})
```

---

## Updating the Application

1. Pull latest code: `git pull`
2. Install dependencies: `npm install`
3. Run migrations: `npm run prisma:migrate`
4. Rebuild: `npm run build`
5. Restart: `pm2 restart rakuten` (or your process manager)

---

## Support

For issues or questions, refer to:
- Main README: `README.md`
- Implementation docs: `IMPLEMENTATION_SUMMARY.md`
- Quick start: `QUICK_START_PARALLEL.md`
