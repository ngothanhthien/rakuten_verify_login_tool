import { buildContainer } from './container'
import { createHttpServer } from './infrastructure/http/express'
import { WebSocketServer } from 'ws'
import { asValue } from 'awilix'

async function bootstrap() {
  const container = buildContainer()

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
