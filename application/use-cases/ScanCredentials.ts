import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import { CredentialStatus } from "../../core/value-objects/CredentialStatus";
import { WorkerProxyAssignment } from "../../core/value-objects/WorkerProxyAssignment";
import { createWorkerContext } from "../../core/value-objects/WorkerContext";
import IUiNotifier from "../ports/IUiNotifier";
import IVerifyService from "../ports/IVerifyService";

export interface ScanCredentialsConfig {
  batchSize?: number;
  workerId?: string;
  proxyAssignment?: WorkerProxyAssignment;
}

export default class ScanCredentialsUseCase {
  private readonly batchSize: number;
  private readonly workerId: string;
  private readonly proxyAssignment: WorkerProxyAssignment | null;

  constructor(
    private readonly repository: ICredentialRepository,
    private readonly verifyService: IVerifyService,
    private readonly uiNotifier: IUiNotifier,
    config?: ScanCredentialsConfig,
  ) {
    this.batchSize = config?.batchSize ?? 3;
    this.workerId = config?.workerId ?? 'default-worker';
    this.proxyAssignment = config?.proxyAssignment ?? null;
  }

  /**
   * Execute credential scanning with parallel processing support.
   * Uses atomic claim/release pattern to prevent duplicate processing.
   *
   * @returns Number of credentials processed in this batch
   */
  async execute(): Promise<number> {
    // Validate proxy assignment is present
    if (!this.proxyAssignment) {
      throw new Error(
        `ScanCredentialsUseCase requires proxyAssignment to be provided. ` +
        `Worker ${this.workerId} cannot proceed without proxy assignment.`
      );
    }

    // Create WorkerContext from proxy assignment
    const workerContext = createWorkerContext(this.workerId, this.proxyAssignment);

    // Atomically claim credentials for this worker
    const credentials = await this.repository.findAndClaimPending(this.batchSize, this.workerId);

    if (credentials.length === 0) {
      return 0;
    }

    let processedCount = 0;

    // Process each claimed credential
    for (const credential of credentials) {
      try {
        const verified = await this.verifyService.verify(credential, workerContext);

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
