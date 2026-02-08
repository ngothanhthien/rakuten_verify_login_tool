import path from 'path'
import fs from 'fs-extra'
import { spawnSync } from 'node:child_process'

type PackageOptions = {
  zip: boolean
}

async function importTsup() {
  try {
    return await import('tsup')
  } catch (error) {
    throw new Error(
      'tsup is required for packaging. Install it with "npm install -D tsup" before running build.ts.'
    )
  }
}

async function main() {
  const options: PackageOptions = {
    zip: process.argv.includes('--zip'),
  }

  const distDir = path.join(process.cwd(), 'dist-windows')
  const pkg = await fs.readJson('package.json')
  const dependencies = Object.keys(pkg.dependencies || {})
  // These stay as real node_modules because they rely on native/runtime assets
  const runtimeExternals = ['@prisma/client', 'patchright', 'patchright-core', 'prisma', 'geoip-lite']
  const bundledDeps = dependencies.filter((dep) => !runtimeExternals.includes(dep))

  console.log('🧹 Cleaning dist directory...')
  await fs.emptyDir(distDir)

  console.log('📦 Bundling backend with tsup...')
  const { build } = await importTsup()
  await build({
    entry: ['main.ts'],
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    target: 'node20',
    platform: 'node',
    outDir: distDir,
    clean: false,
    bundle: true,
    noExternal: bundledDeps,
    external: runtimeExternals,
    sourcemap: false,
    minify: false,
    splitting: false,
    shims: true,
    dts: false,
  })

  await copyFrontend(distDir)
  await copyLocalScripts(distDir)
  await copyEnvAndDatabase(distDir)
  await copyPrismaAssets(distDir)
  await copyPrismaMigrations(distDir)
  await copyRuntimeNodeModules(distDir, runtimeExternals)
  await regeneratePrismaClient(distDir)
  await runMigrations(distDir)
  await createStartScripts(distDir)

  if (options.zip) {
    await zipBundle(distDir)
  }

  console.log('✅ Build complete! dist-windows is ready to zip and run on Windows (Node.js required).')
}

async function copyFrontend(distDir: string) {
  console.log('🎨 Copying frontend assets...')
  const frontendPath = path.join(process.cwd(), 'frontend-dist')
  if (!(await fs.pathExists(frontendPath))) {
    throw new Error('frontend-dist not found. Run "npm run build:frontend" first.')
  }
  await fs.copy(frontendPath, path.join(distDir, 'frontend-dist'))
}

async function copyGeoipData(distDir: string) {
  console.log('🌍 Copying geoip-lite data files...')
  const geoipDataSource = path.join(process.cwd(), 'node_modules/geoip-lite/data')
  if (!(await fs.pathExists(geoipDataSource))) {
    console.warn('⚠️  geoip-lite data directory not found, skipping.')
    return
  }
  const geoipDataTarget = path.join(distDir, 'data')
  await fs.ensureDir(geoipDataTarget)
  await fs.copy(geoipDataSource, geoipDataTarget)
}

async function copyLocalScripts(distDir: string) {
  console.log('📜 Copying local JS scripts...')
  const scriptsSource = path.join(process.cwd(), 'assets/js')
  if (await fs.pathExists(scriptsSource)) {
    await fs.copy(scriptsSource, path.join(distDir, 'assets/js'))
  } else {
    console.log('⚠️  No assets/js directory found, skipping local scripts.')
  }
}

async function copyEnvAndDatabase(distDir: string) {
  console.log('🗂  Preparing env and database files...')
  const dbSource = path.join(process.cwd(), 'infrastructure/db/prisma/infrastructure/db/prisma/dev.db')
  if (!(await fs.pathExists(dbSource))) {
    throw new Error('SQLite file not found at infrastructure/db/prisma/dev.db')
  }
  await fs.copy(dbSource, path.join(distDir, 'dev.db'))

  const envContent = [
    'DATABASE_URL="file:./dev.db"',
    'PORT=3000',
    '',
  ].join('\n')
  await fs.writeFile(path.join(distDir, '.env'), envContent)

  const schemaPath = path.join(process.cwd(), 'infrastructure/db/prisma/schema.prisma')
  if (await fs.pathExists(schemaPath)) {
    let schemaContent = await fs.readFile(schemaPath, 'utf-8')
    // Fix output path for dist-windows
    schemaContent = schemaContent.replace(
      'output        = "../../../node_modules/.prisma/client"',
      'output        = "./node_modules/.prisma/client"'
    )
    await fs.writeFile(path.join(distDir, 'schema.prisma'), schemaContent)
  }
}

async function copyPrismaAssets(distDir: string) {
  console.log('🗄️  Copying Prisma query engine assets...')
  const prismaSource = path.join(process.cwd(), 'node_modules/.prisma/client')
  if (!(await fs.pathExists(prismaSource))) {
    throw new Error('Prisma client not generated. Run "npm install" then "npm run prisma:generate" first.')
  }

  const prismaTarget = path.join(distDir, 'node_modules/.prisma/client')
  await fs.ensureDir(prismaTarget)
  await fs.copy(prismaSource, prismaTarget)
}

async function copyPrismaMigrations(distDir: string) {
  console.log('📜 Copying Prisma migrations...')
  const migrationsSource = path.join(process.cwd(), 'infrastructure/db/prisma/migrations')
  if (!(await fs.pathExists(migrationsSource))) {
    console.warn('⚠️  No migrations directory found.')
    return
  }
  await fs.copy(migrationsSource, path.join(distDir, 'migrations'))
}

async function copyRuntimeNodeModules(distDir: string, moduleNames: string[]) {
  console.log('📁 Copying runtime node_modules for externalized packages...')
  const nodeModulesRoot = path.join(process.cwd(), 'node_modules')
  const targetNodeModules = path.join(distDir, 'node_modules')
  await fs.ensureDir(targetNodeModules)

  for (const mod of moduleNames) {
    const source = path.join(nodeModulesRoot, mod)
    if (!(await fs.pathExists(source))) {
      throw new Error(`Missing dependency ${mod} in node_modules. Install dependencies before packaging.`)
    }
    await fs.copy(source, path.join(targetNodeModules, mod))

    // Also copy dependencies for geoip-lite
    if (mod === 'geoip-lite') {
      const geoipDeps = ['async', 'chalk', 'iconv-lite', 'ip-address', 'lazy', 'rimraf', 'yauzl']
      for (const dep of geoipDeps) {
        const depSource = path.join(nodeModulesRoot, dep)
        if (!(await fs.pathExists(depSource))) {
          throw new Error(`Missing geoip-lite dependency ${dep} in node_modules.`)
        }
        await fs.copy(depSource, path.join(targetNodeModules, dep))
      }
    }
  }
}

async function regeneratePrismaClient(distDir: string) {
  console.log('🔧 Regenerating Prisma client for dist-windows...')
  const { spawnSync } = await import('node:child_process')
  
  const result = spawnSync('npx', ['prisma', 'generate', '--schema=dist-windows/schema.prisma'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `file:./${path.basename(distDir)}/dev.db` }
  })

  if (result.status !== 0) {
    throw new Error('Prisma client generation failed')
  }
}

async function runMigrations(distDir: string) {
  console.log('🔄 Running database migrations...')
  const { spawnSync } = await import('node:child_process')
  
  const result = spawnSync('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema=dist-windows/schema.prisma'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `file:./${path.basename(distDir)}/dev.db` }
  })

  if (result.status !== 0) {
    console.warn('⚠️  Migration failed - database may need manual setup')
  }
}

async function createStartScripts(distDir: string) {
  console.log('🚀 Creating start scripts...')
const winScript = `
@echo off
setlocal
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%"

REM Environment
if "%PORT%"=="" set PORT=3000
if "%DATABASE_URL%"=="" set DATABASE_URL=file:%SCRIPT_DIR%dev.db
set PRISMA_CLIENT_ENGINE_TYPE=library
set NODE_OPTIONS=--enable-source-maps
if "%RUN_MIGRATIONS%"=="" set RUN_MIGRATIONS=0

REM Try to point Prisma to a Windows engine shipped in .prisma
if exist "%SCRIPT_DIR%node_modules\\.prisma\\client\\libquery_engine-windows.dll.node" (
  set PRISMA_QUERY_ENGINE_LIBRARY=%SCRIPT_DIR%node_modules\\.prisma\\client\\libquery_engine-windows.dll.node
) else if exist "%SCRIPT_DIR%node_modules\\.prisma\\client\\query_engine-windows.dll.node" (
  set PRISMA_QUERY_ENGINE_LIBRARY=%SCRIPT_DIR%node_modules\\.prisma\\client\\query_engine-windows.dll.node
)

if "%RUN_MIGRATIONS%"=="1" (
  if exist "%SCRIPT_DIR%node_modules\\prisma\\build\\index.js" (
    echo Running migrations...
    node "%SCRIPT_DIR%node_modules\\prisma\\build\\index.js" migrate deploy --schema "%SCRIPT_DIR%schema.prisma"
    if errorlevel 1 (
      echo Prisma migrate failed. See run.log for details.
      exit /b 1
    )
  ) else (
    echo Prisma CLI not found; skipping migrations.
  )
) else (
  echo RUN_MIGRATIONS is 0; skipping migrations.
)

echo Running Rakuten (Windows)...
echo Logs -> %SCRIPT_DIR%run.log
node "%SCRIPT_DIR%main.cjs" >> "%SCRIPT_DIR%run.log" 2>&1
set EXIT_CODE=%errorlevel%
echo Node exited with code %EXIT_CODE%
if not "%EXIT_CODE%"=="0" (
  echo --- Tail of run.log ---
  powershell -Command "Get-Content -Path \"%SCRIPT_DIR%run.log\" -Tail 40"
)
popd
pause
`

  const nixScript = `#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export PORT=\${PORT:-3000}
export DATABASE_URL=\${DATABASE_URL:-file:$SCRIPT_DIR/dev.db}
export PRISMA_CLIENT_ENGINE_TYPE=library
export NODE_OPTIONS=--enable-source-maps
export RUN_MIGRATIONS=\${RUN_MIGRATIONS:-0}

if [ -f "$SCRIPT_DIR/node_modules/.prisma/client/libquery_engine-linux-musl.so.node" ]; then
  export PRISMA_QUERY_ENGINE_LIBRARY="$SCRIPT_DIR/node_modules/.prisma/client/libquery_engine-linux-musl.so.node"
elif [ -f "$SCRIPT_DIR/node_modules/.prisma/client/libquery_engine-linux-openssl-3.0.x.so.node" ]; then
  export PRISMA_QUERY_ENGINE_LIBRARY="$SCRIPT_DIR/node_modules/.prisma/client/libquery_engine-linux-openssl-3.0.x.so.node"
fi

if [ "\${RUN_MIGRATIONS}" = "1" ]; then
  if [ -f "$SCRIPT_DIR/node_modules/prisma/build/index.js" ]; then
    echo "Running migrations..."
    node "$SCRIPT_DIR/node_modules/prisma/build/index.js" migrate deploy --schema "$SCRIPT_DIR/schema.prisma"
  else
    echo "Prisma CLI not found; skipping migrations."
  fi
else
  echo "RUN_MIGRATIONS is 0; skipping migrations."
fi

echo "Running Rakuten (Unix)..."
echo "Logs -> $SCRIPT_DIR/run.log"
node "$SCRIPT_DIR/main.cjs" >> "$SCRIPT_DIR/run.log" 2>&1
echo "Node exited with code $?"
tail -n 40 "$SCRIPT_DIR/run.log" || true
`

  await fs.writeFile(path.join(distDir, 'start.bat'), winScript, 'utf8')
  await fs.writeFile(path.join(distDir, 'start.sh'), nixScript, 'utf8')
  await fs.chmod(path.join(distDir, 'start.sh'), 0o755)
}

async function zipBundle(distDir: string) {
  const zipTarget = path.join(process.cwd(), 'dist-windows.zip')
  console.log(`🗜️  Zipping to ${zipTarget}...`)
  const result = spawnSync('zip', ['-r', '-q', zipTarget, path.basename(distDir)], {
    cwd: path.dirname(distDir),
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    console.warn('⚠️  zip command not available or failed. Bundle is still in dist-windows/')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
