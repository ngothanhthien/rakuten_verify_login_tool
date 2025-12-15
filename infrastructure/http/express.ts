// core/interface/http/express/server.ts
import express, {
  Express,
  Request,
  Response,
  NextFunction,
} from 'express'

import { AwilixContainer } from 'awilix'
import { scopePerRequest } from 'awilix-express'
import { registerRoutes } from './routes'
import cors from 'cors'
import path from 'path'
import fs from 'fs'

export function createHttpServer(rootContainer: AwilixContainer): Express {
  const app = express()

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }))
  app.use(express.json())

  app.use(scopePerRequest(rootContainer))

  registerRoutes(app)

  const staticDir = path.join(process.cwd(), "frontend-dist")
  app.use(express.static(staticDir))

  // SPA fallback (Vue router history mode) for non-API routes
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next()
    }

    const accept = req.headers.accept ?? ''
    if (typeof accept === 'string' && accept.includes('text/html')) {
      const indexPath = path.join(staticDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath)
      }
    }

    next()
  })

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      message: 'Not Found',
      path: req.path,
    })
  })

  app.use(
    (
      err: any,
      req: Request,
      res: Response,
      next: NextFunction, // eslint-disable-line
    ) => {
      console.error(err)

      const status = err.statusCode || 500
      const message = err.message || 'Internal Server Error'

      res.status(status).json({
        message,
      })
    },
  )

  return app
}
