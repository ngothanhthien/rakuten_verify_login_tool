#!/bin/bash

# Release Packaging Script
# Creates a minimal distribution package with only production files

set -e  # Exit on error

RELEASE_NAME="rakuten-release-$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="releases/$RELEASE_NAME"

echo "📦 Building release package: $RELEASE_NAME"
echo ""

# Step 1: Build the application
echo "🔨 Building application..."
npm run build

# Step 2: Create release directory structure
echo "📁 Creating release directory..."
mkdir -p "$RELEASE_DIR"

# Step 3: Copy essential files
echo "📋 Copying production files..."

# Copy compiled backend
cp -r dist/ "$RELEASE_DIR/"

# Copy frontend build
cp -r frontend-dist/ "$RELEASE_DIR/"

# Copy Prisma schema and migrations
mkdir -p "$RELEASE_DIR/infrastructure/db/prisma"
cp infrastructure/db/prisma/schema.prisma "$RELEASE_DIR/infrastructure/db/prisma/"
# Copy compiled prisma.config.js instead of .ts source
cp dist/infrastructure/db/prisma/prisma.config.js "$RELEASE_DIR/infrastructure/db/prisma/"
cp -r infrastructure/db/prisma/migrations/ "$RELEASE_DIR/infrastructure/db/prisma/"

# Copy Prisma generated client (if exists)
if [ -d "infrastructure/db/prisma/generated" ]; then
    cp -r infrastructure/db/prisma/generated/ "$RELEASE_DIR/infrastructure/db/prisma/"
fi

# Copy package.json (for dependencies)
cp package.json "$RELEASE_DIR/"
cp package-lock.json "$RELEASE_DIR/" 2>/dev/null || true

# Copy environment example
cp .env.example "$RELEASE_DIR/"

# Step 4: Create minimal startup script
cat > "$RELEASE_DIR/start.sh" << 'EOF'
#!/bin/bash
set -ea

echo "🚀 Starting Rakuten Application..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Copy .env.example to .env and configure it:"
    echo "   cp .env.example .env"
    exit 1
fi

# Load environment variables and export them
set -a
source .env
set +a

# Install dependencies if node_modules doesn't exist
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies (first run only)..."
    npm install --production
fi

# Generate Prisma client if needed
if [ ! -d infrastructure/db/prisma/generated ]; then
    echo "🔧 Generating Prisma client..."
    (cd infrastructure/db/prisma && npx prisma generate)
fi

# Run database migrations
echo "🗄️  Running database migrations..."
# Fix relative path in DATABASE_URL for when we cd into prisma directory
_DB_URL="${DATABASE_URL:-file:./dev.db}"
# If it's a relative file: path, make it absolute from current directory
if [[ "$_DB_URL" == file:./dev.db ]]; then
    _DB_URL="file:$(pwd)/dev.db"
fi
(cd infrastructure/db/prisma && DATABASE_URL="$_DB_URL" npx prisma migrate deploy)

# Install Playwright browser if needed
if ! npx patchright --version &> /dev/null; then
    echo "🌐 Installing Playwright browser (first run only)..."
    npx patchright install chromium
fi

# Start the application
echo "✅ Starting server..."
echo "📡 Server will be available at http://localhost:${PORT:-3000}"
echo ""

NODE_ENV=production node dist/main.js
EOF

chmod +x "$RELEASE_DIR/start.sh"

# Step 5: Create README for the release
cat > "$RELEASE_DIR/README.md" << 'EOF'
# Rakuten Application - Production Release

## Quick Start

1. **Install Node.js** (v20.19.0 or v22.12.0+)
   https://nodejs.org/

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run the application**
   ```bash
   ./start.sh
   ```

The server will start at http://localhost:3000

## What's Included

- `dist/` - Compiled backend application
- `frontend-dist/` - Built frontend (Vue 3 SPA)
- `infrastructure/db/prisma/` - Database schema & migrations
- `package.json` - Dependencies list
- `start.sh` - Startup script
- `.env.example` - Configuration template

## First Run

On first run, the startup script will automatically:
- Install Node.js dependencies
- Generate Prisma database client
- Run database migrations
- Install Playwright browser
- Start the server

## Requirements

- Node.js v20.19.0 or v22.12.0+
- ~500MB disk space (for node_modules and browser)
- Port 3000 available (or configure PORT in .env)

## Environment Variables

Edit `.env` to configure:

```env
PORT=3000                           # Server port
DATABASE_URL="file:./dev.db"       # SQLite database path
CREDENTIAL_CHECK_CONCURRENCY=3     # Parallel workers
TELEGRAM_BOT_TOKEN=                # Optional: Telegram notifications
TELEGRAM_CHAT_ID=                  # Optional: Telegram chat ID
```

## Stopping the Server

Press `Ctrl+C` in the terminal

## Production Deployment

For production, consider using a process manager:

```bash
# Using PM2
npm install -g pm2
pm2 start npm --name "rakuten" -- start

# Or using systemd (Linux)
# See full documentation for systemd service setup
```

## Troubleshooting

**Dependencies not installing:**
```bash
rm -rf node_modules package-lock.json
npm install --production
```

**Database errors:**
```bash
npx prisma migrate deploy --schema=./infrastructure/db/prisma/schema.prisma
```

**Browser not found:**
```bash
npx patchright install chromium
```

## Support

This is a production build. Source code and development tools are not included.
EOF

# Step 6: Create archive
echo "🗜️  Creating ZIP archive..."
cd releases
zip -r "$RELEASE_NAME.zip" "$RELEASE_NAME/" > /dev/null
cd ..

# Calculate size
ARCHIVE_SIZE=$(du -sh "releases/$RELEASE_NAME.zip" | cut -f1)

echo ""
echo "✅ Release package created successfully!"
echo ""
echo "📦 Package: releases/$RELEASE_NAME.zip"
echo "📏 Size: $ARCHIVE_SIZE"
echo ""
echo "📤 To deploy, copy the archive to your server and extract:"
echo "   unzip $RELEASE_NAME.zip"
echo "   cd $RELEASE_NAME"
echo "   cp .env.example .env"
echo "   # Edit .env with your configuration"
echo "   ./start.sh"
echo ""
