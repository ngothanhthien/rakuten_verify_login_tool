import { CredentialStatus } from "./CredentialStatus";

export default interface CredentialListFilter {
  status?: CredentialStatus;
  q?: string;
}
