import { Credential } from "../../core/entities/Credential";

export default interface IVerifyService {
  verify(credential: Credential): Promise<boolean>
}
