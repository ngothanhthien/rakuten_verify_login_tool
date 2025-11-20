import { Credential } from "../entities/Credential";
import CreateCredentialData from "../value-objects/CreateCredentialData";
import UpdateCredentialData from "../value-objects/UpdateCredentialData";
import PaginateQuery from "../value-objects/PaginateQuery";
import CredentialListFilter from "../value-objects/CredentialListFilter";
import PaginateResponse from "../value-objects/PaginateResponse";
import type { CredentialProps } from "../entities/Credential";
import type CredentialStatistics from "../value-objects/CredentialStatistics";

export default interface ICredentialRepository {
  isExists(email: string): Promise<boolean>;
  create(data: CreateCredentialData): Promise<Credential>;
  update(id: number, data: UpdateCredentialData): Promise<Credential>;
  paginatedList(paginateQuery: PaginateQuery, filter: CredentialListFilter): Promise<PaginateResponse<CredentialProps>>;
  findPending(limit: number): Promise<Credential[]>;
  findByStatus(status: string): Promise<Credential[]>;
  bulkDelete(ids: number[]): Promise<void>;
  getStatistics(): Promise<CredentialStatistics>;
}
