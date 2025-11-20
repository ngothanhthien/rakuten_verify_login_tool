import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import { CredentialStatus } from "../../core/value-objects/CredentialStatus";
import IUiNotifier from "../ports/IUiNotifier";
import IVerifyService from "../ports/IVerifyService";
import { Credential } from "../../core/entities/Credential";

export default class ScanCredentialsUseCase {
  constructor(
    private readonly repository: ICredentialRepository,
    private readonly verifyService: IVerifyService,
    private readonly uiNotifier: IUiNotifier,
  ) {}

  async execute(): Promise<void> {
    const credentials = await this.repository.findPending(3)
    for (const credential of credentials) {
      const verified = await this.verifyService.verify(credential)
      await this.repository.update(credential.id, { status: this.getStatus(verified), checkedAt: new Date() })
      if (verified) {
        this.uiNotifier.notify(`Credential ${credential.email}:${credential.password} verified`, { color: 'green' })
      }
    }
  }

  private getStatus(verified: boolean): CredentialStatus {
    return verified ? CredentialStatus.ACTIVE : CredentialStatus.INACTIVE
  }
}
