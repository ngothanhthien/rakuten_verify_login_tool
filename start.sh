#!/bin/bash

# Production startup script for Rakuten application
# This script ensures the application is properly configured before starting

set -ea  # Exit on error

echo "🚀 Starting Rakuten Application..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please copy .env.example to .env and configure it:"
    echo "   cp .env.example .env"
    exit 1
fi

# Load environment variables and export them
set -a  # Automatically export all variables
source .env
set +a  # Stop auto-exporting

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Check if dist/ directory exists
if [ ! -d dist ]; then
    echo "🔨 Building application..."
    npm run build
fi

# Check if Prisma client is generated
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

# Check if Playwright browsers are installed
if ! npx patchright --version &> /dev/null; then
    echo "🌐 Installing Playwright browsers..."
    npx patchright install chromium
fi

# Start the application
echo "✅ All checks passed! Starting server..."
echo "📡 Server will be available at http://localhost:${PORT:-3000}"
echo ""

# Start with Node.js
NODE_ENV=production node dist/main.js
