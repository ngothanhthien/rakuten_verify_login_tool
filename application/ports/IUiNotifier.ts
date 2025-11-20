import { NotifyOptions } from "../../types/core";

export default interface IUiNotifier {
  notify(message: string, options?: NotifyOptions): void
}
