import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import { CredentialStatus } from "../../core/value-objects/CredentialStatus";
import { WorkerContext } from "../../core/value-objects/WorkerContext";
import IUiNotifier from "../ports/IUiNotifier";
import IVerifyService from "../ports/IVerifyService";

export interface ScanCredentialsConfig {
  batchSize?: number;
  workerId?: string;
  workerContext?: WorkerContext;
}

export default class ScanCredentialsUseCase {
  private readonly batchSize: number;
  private readonly workerId: string;
  private readonly workerContext: WorkerContext | null;

  constructor(
    private readonly repository: ICredentialRepository,
    private readonly verifyService: IVerifyService,
    private readonly uiNotifier: IUiNotifier,
    config?: ScanCredentialsConfig,
  ) {
    this.batchSize = config?.batchSize ?? 3;
    this.workerId = config?.workerId ?? 'default-worker';
    this.workerContext = config?.workerContext ?? null;
  }

  /**
   * Execute credential scanning with parallel processing support.
   * Uses atomic claim/release pattern to prevent duplicate processing.
   *
   * @returns Number of credentials processed in this batch
   */
  async execute(): Promise<number> {
    // Atomically claim credentials for this worker
    const credentials = await this.repository.findAndClaimPending(this.batchSize, this.workerId);

    if (credentials.length === 0) {
      return 0;
    }

    let processedCount = 0;

    // Process each claimed credential
    for (const credential of credentials) {
      try {
        const verified = await this.verifyService.verify(credential, this.workerContext!);

        // Update status and release claim in one operation
        await this.repository.update(credential.id, {
          status: this.getStatus(verified),
          checkedAt: new Date()
        });

        // Release the claim after successful processing
        await this.repository.releaseClaim(credential.id);

        if (verified) {
          this.uiNotifier.notify(
            `Credential ${credential.email}:${credential.password} verified`,
            { color: 'green' }
          );
        }

        processedCount++;
      } catch (error) {
        // Release claim on error so it can be retried
        await this.repository.releaseClaim(credential.id);
        console.error(`Error processing credential ${credential.id}:`, error);
      }
    }

    return processedCount;
  }

  private getStatus(verified: boolean): CredentialStatus {
    return verified ? CredentialStatus.ACTIVE : CredentialStatus.INACTIVE
  }
}
