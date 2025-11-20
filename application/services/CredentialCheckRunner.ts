// application/services/CredentialCheckRunner.ts
import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import IVerifyService from "../ports/IVerifyService";      // ví dụ: PlaywrightVerify đang implements cái này
import IUiNotifier from "../ports/IUiNotifier";            // nếu bạn có
import ScanCredentialsUseCase from "../use-cases/ScanCredentials";

export interface CheckStatus {
  isRunning: boolean;
  total: number;
  processed: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError?: string | null;
}

export default class CredentialCheckRunner {
  private isRunning = false;
  private status: CheckStatus = {
    isRunning: false,
    total: 0,
    processed: 0,
    startedAt: null,
    finishedAt: null,
    lastError: null,
  };

  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly verifyService: IVerifyService,
    private readonly uiNotifier: IUiNotifier,
  ) {}

  getStatus(): CheckStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.status = {
      isRunning: true,
      total: 0,
      processed: 0,
      startedAt: new Date(),
      finishedAt: null,
      lastError: null,
    };

    this.run().catch((err) => {
      this.status.lastError = err?.message ?? 'Unknown error';
      this.isRunning = false;
      this.status.isRunning = false;
      this.status.finishedAt = new Date();
    });
  }

  stop(): void {
    this.isRunning = false;
  }

  private async run(): Promise<void> {
    while (this.isRunning) {
      const action = new ScanCredentialsUseCase(this.credentialRepository, this.verifyService, this.uiNotifier)
      await action.execute()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }


    this.isRunning = false;
    this.status.isRunning = false;
    this.status.finishedAt = new Date();
  }
}
