import { Credential } from "../../core/entities/Credential";
import { WorkerContext } from "../../core/value-objects/WorkerContext";

export default interface IVerifyService {
  verify(credential: Credential, context: WorkerContext): Promise<boolean>
}
