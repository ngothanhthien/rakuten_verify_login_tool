// core/interface/http/express/server.ts
import { buildContainer } from './container'
import { createHttpServer } from './infrastructure/http/express'
import { WebSocketServer } from 'ws'
import { asValue } from 'awilix'
import path from 'path'
import fs from 'fs'
import { CustomRatSelector } from './application/services/CustomRatSelector'

async function bootstrap() {
  // Log DB location to help diagnose missing tables in packaged builds
  const dbUrl = process.env.DATABASE_URL || ''
  const dbPath = dbUrl.startsWith('file:') ? dbUrl.replace('file:', '') : dbUrl
  if (dbPath) {
    const resolved = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath)
    const exists = fs.existsSync(resolved)
    console.log('[bootstrap] DATABASE_URL=', dbUrl, 'resolved=', resolved, 'exists=', exists)
  } else {
    console.log('[bootstrap] DATABASE_URL not set')
  }

  const container = await buildContainer()

  // Validate at least one active RAT exists
  const customRatSelector = container.resolve<CustomRatSelector>('customRatSelector')
  const hasActiveRats = await customRatSelector.checkAnyActiveRats()

  if (!hasActiveRats) {
    console.warn('[Startup] No active RATs found in database.')
    console.warn('[Startup] Please add at least one RAT using: POST /api/rats')
    console.warn('[Startup] Example: curl -X POST http://localhost:3000/api/rats -H "Content-Type: application/json" -d \'{"components":{}}\'')
    console.warn('[Startup] Server will start but credential checking may not work properly.')
  } else {
    console.log('[Startup] Custom RAT system initialized with active RATs')
  }

  const app = createHttpServer(container) // inject use cases, controllers
  const port = process.env.PORT || 3000

  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`)
  })

  const wss = new WebSocketServer({ server })
  container.register({
    wss: asValue(wss),
  })

  wss.on('connection', (socket, request) => {
    console.log('WS client connected:', request.socket.remoteAddress)

    socket.on('close', () => {
      console.log('WS client disconnected')
    })
  })
}

bootstrap()
