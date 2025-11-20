import IUiNotifier from "../../application/ports/IUiNotifier";
import { NotifyOptions } from "../../types/core";
import type { WebSocketServer } from 'ws'

export default class WebsocketNotifier implements IUiNotifier {
  constructor(private readonly wss: WebSocketServer) {}

  notify(message: string, options?: NotifyOptions): void {
    this.wss.clients.forEach((client: any) => {
      if (client.readyState === client.OPEN) {
        client.send(message, options)
      }
    })
  }
}
