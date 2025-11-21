# Minimal Distribution Package Guide

## Quick Answer: YES!

You can package **only the build files + startup script** into a single archive.

---

## How to Create the Package

Run this single command:

```bash
./package-release.sh
```

This creates: `releases/rakuten-release-YYYYMMDD-HHMMSS.tar.gz` (~224KB)

---

## What's Included (Minimal Files Only)

```
rakuten-release-YYYYMMDD-HHMMSS/
├── dist/                      # Compiled JavaScript (NO .ts files)
├── frontend-dist/             # Built Vue app (static HTML/CSS/JS)
├── infrastructure/db/prisma/  # Database schema + migrations only
├── package.json               # For installing dependencies
├── package-lock.json          # Locked dependency versions
├── .env.example               # Configuration template
├── start.sh                   # Auto-setup & start script
└── README.md                  # Quick start instructions
```

**Total size**: ~224KB (without node_modules)

**NO source code included** - only production-ready files!

---

## How to Deploy

### 1. Send the Package

Copy the `.tar.gz` file to your server:

```bash
scp releases/rakuten-release-*.tar.gz user@server:/path/
```

Or download from anywhere - it's portable!

### 2. On the Server

```bash
# Extract
tar -xzf rakuten-release-20251121-010129.tar.gz
cd rakuten-release-20251121-010129

# Configure
cp .env.example .env
nano .env  # Edit your settings

# Run (ONE command - handles everything!)
./start.sh
```

The `start.sh` script automatically:
- Installs Node.js dependencies (~500MB will be downloaded)
- Generates Prisma client
- Runs database migrations
- Installs Playwright browser
- Starts the server

---

## What Happens on First Run

```
🚀 Starting Rakuten Application...
📦 Installing dependencies (first run only)...
   [Downloads ~500MB node_modules]
🔧 Generating Prisma client...
🗄️  Running database migrations...
🌐 Installing Playwright browser (first run only)...
   [Downloads Chromium browser]
✅ Starting server...
📡 Server will be available at http://localhost:3000
```

**Next runs are instant** - dependencies already installed!

---

## Requirements on Target Server

- **Node.js** v20.19.0 or v22.12.0+
- **Internet connection** (for first-run dependency installation)
- **~500MB disk space** (for node_modules + browser)
- **Port 3000** available (or configure in .env)

---

## File Size Breakdown

| Component | Size | Downloaded When? |
|-----------|------|------------------|
| Package archive | 224KB | You transfer this |
| node_modules | ~300MB | First run (auto) |
| Chromium browser | ~200MB | First run (auto) |
| Database | ~10KB | Runtime (created) |
| **Total** | **~500MB** | After first run |

---

## Configuration (Edit .env)

```env
PORT=3000
DATABASE_URL="file:./dev.db"
CREDENTIAL_CHECK_CONCURRENCY=3
TELEGRAM_BOT_TOKEN=your_token_here      # Optional
TELEGRAM_CHAT_ID=your_chat_id_here      # Optional
```

---

## Running in Production

### Option 1: Direct (Simple)
```bash
./start.sh
```

### Option 2: Background with PM2 (Recommended)
```bash
npm install -g pm2
pm2 start npm --name "rakuten" -- start
pm2 save
pm2 startup
```

### Option 3: Systemd Service (Linux)
Create `/etc/systemd/system/rakuten.service`:
```ini
[Service]
WorkingDirectory=/path/to/rakuten-release-XXXXXX
ExecStart=/usr/bin/node dist/main.js
Restart=always
```

---

## Multiple Servers?

Just copy the same `.tar.gz` to multiple servers!

```bash
# Create once
./package-release.sh

# Deploy everywhere
for server in server1 server2 server3; do
    scp releases/rakuten-release-*.tar.gz user@$server:/app/
done
```

Each server runs independently with its own database.

---

## Advantages of This Approach

✅ **Tiny package** - Only 224KB to transfer  
✅ **No source code** - Production files only  
✅ **Self-contained** - Includes everything needed  
✅ **Auto-setup** - `start.sh` handles all configuration  
✅ **Portable** - Works on any Linux/macOS/Windows with Node.js  
✅ **Clean** - No development tools or TypeScript files  

---

## Example Workflow

```bash
# On your development machine
./package-release.sh

# Package created: releases/rakuten-release-20251121-010129.tar.gz (224K)

# Send to production server
scp releases/rakuten-release-20251121-010129.tar.gz prod:/app/

# SSH to production
ssh prod
cd /app

# Extract and run
tar -xzf rakuten-release-20251121-010129.tar.gz
cd rakuten-release-20251121-010129
cp .env.example .env
nano .env  # Configure
./start.sh

# Done! Server running at http://localhost:3000
```

---

## Updating in Production

To update to a new version:

```bash
# Create new release
./package-release.sh

# Deploy new version
scp releases/rakuten-release-NEW.tar.gz prod:/app/

# On server
cd /app
tar -xzf rakuten-release-NEW.tar.gz
cd rakuten-release-NEW

# Copy old config
cp ../rakuten-release-OLD/.env .

# Copy old database (optional - to keep data)
cp ../rakuten-release-OLD/dev.db .

# Start new version
pm2 stop rakuten
./start.sh
```

---

## Summary

**Yes!** You can create a minimal 224KB package with:
```bash
./package-release.sh
```

Then send **only** the `.tar.gz` file + the recipient runs:
```bash
tar -xzf rakuten-release-*.tar.gz
cd rakuten-release-*
cp .env.example .env  # Configure
./start.sh            # Run!
```

Everything else (dependencies, database, browser) is auto-installed on first run.
