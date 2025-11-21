import ICredentialRepository from "../../core/repositories/ICredentialRepository";

export default class DeleteUncheckedCredentials {
  constructor(
    private readonly repository: ICredentialRepository,
  ) {}

  /**
   * Delete all credentials that have never been verified.
   * Only deletes credentials where:
   * - checkedAt is null (never been verified)
   * - processingBy is null (not currently being processed)
   * - claimedAt is null (not currently claimed by any worker)
   * 
   * @returns Number of credentials deleted
   */
  async execute(): Promise<number> {
    const deletedCount = await this.repository.deleteUnchecked();
    return deletedCount;
  }
}

