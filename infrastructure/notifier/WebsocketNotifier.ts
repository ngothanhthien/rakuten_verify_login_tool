import IUiNotifier from "../../application/ports/IUiNotifier";
import { NotifyOptions } from "../../types/core";
import type { WebSocketServer } from 'ws'

export default class WebsocketNotifier implements IUiNotifier {
  notify(message: string, options?: NotifyOptions): void {

  }
}
