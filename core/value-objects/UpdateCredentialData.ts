import { CredentialStatus } from "./CredentialStatus";

export default interface UpdateCredentialData {
  email?: string;
  password?: string;
  status?: CredentialStatus;
  checkedAt?: Date;
}
