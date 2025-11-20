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

export function createHttpServer(rootContainer: AwilixContainer): Express {
  const app = express()

  app.use(express.json())

  app.use(scopePerRequest(rootContainer))

  registerRoutes(app)

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
