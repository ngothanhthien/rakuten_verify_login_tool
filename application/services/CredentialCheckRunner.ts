// application/services/CredentialCheckRunner.ts
import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import IProxyRepository from "../../core/repositories/IProxyRepository";
import IVerifyService from "../ports/IVerifyService";
import IUiNotifier from "../ports/IUiNotifier";
import ScanCredentialsUseCase from "../use-cases/ScanCredentials";
import SettingService from "./SettingService";
import { WorkerProxyAssignment } from "../../core/value-objects/WorkerProxyAssignment";

export interface CheckStatus {
  isRunning: boolean;
  total: number;
  processed: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError?: string | null;
  concurrency: number;
  activeWorkers: number;
  totalProxies: number;
  activeProxies: number;
  deadProxies: number;
  workersWithDeadProxies: number;
}

export interface CredentialCheckRunnerConfig {
  concurrency?: number;
  batchSize?: number;
  pollingIntervalMs?: number;
  staleClaimTimeoutMinutes?: number;
}

export default class CredentialCheckRunner {
  private isRunning = false;
  private activeWorkers = 0;
  private status: CheckStatus = {
    isRunning: false,
    total: 0,
    processed: 0,
    startedAt: null,
    finishedAt: null,
    lastError: null,
    concurrency: 1,
    activeWorkers: 0,
    totalProxies: 0,
    activeProxies: 0,
    deadProxies: 0,
    workersWithDeadProxies: 0,
  };

  private concurrency: number;
  private readonly batchSize: number;
  private readonly pollingIntervalMs: number;
  private readonly staleClaimTimeoutMinutes: number;
  private workerProxyAssignments: Map<string, WorkerProxyAssignment> = new Map();

  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly proxyRepository: IProxyRepository,
    private readonly verifyService: IVerifyService,
    private readonly uiNotifier: IUiNotifier,
    private readonly settingService: SettingService,
    config?: CredentialCheckRunnerConfig,
  ) {
    this.concurrency = config?.concurrency ?? 10;
    this.batchSize = config?.batchSize ?? 3;
    this.pollingIntervalMs = config?.pollingIntervalMs ?? 1000;
    this.staleClaimTimeoutMinutes = config?.staleClaimTimeoutMinutes ?? 10;
    this.status.concurrency = this.concurrency;
  }

  getStatus(): CheckStatus {
    return { ...this.status, activeWorkers: this.activeWorkers };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const isDebug = process.env.AUTOMATE_DEBUG === 'true';

    this.concurrency = isDebug ? 1 : 40;

    // Validate minimum proxy count
    const activeProxyCount = await this.proxyRepository.getActiveCount();

    if (activeProxyCount < 2) {
      throw new Error(
        `Insufficient proxies: ${activeProxyCount} available, ` +
        `at least 2 required`
      );
    }

    // Assign proxies to workers
    this.workerProxyAssignments = await this.proxyRepository.assignToWorkers();

    if (this.workerProxyAssignments.size === 0) {
      throw new Error('Failed to assign proxies to workers');
    }

    // Calculate total proxies assigned across all workers
    const totalAssignedProxies = Array.from(this.workerProxyAssignments.values())
      .reduce((sum, a) => sum + a.proxies.length, 0);

    const proxyListStr = Array.from(this.workerProxyAssignments.values())
      .map(a => `[${a.proxies.map(p => p.server).join(', ')}]`)
      .join(', ');

    console.log(
      `Assigned ${this.workerProxyAssignments.size} workers with ${totalAssignedProxies} proxies: ${proxyListStr}`
    );

    this.isRunning = true;
    this.status = {
      isRunning: true,
      total: totalAssignedProxies,
      processed: 0,
      startedAt: new Date(),
      finishedAt: null,
      lastError: null,
      concurrency: this.concurrency,
      activeWorkers: 0,
      totalProxies: activeProxyCount,
      activeProxies: activeProxyCount,
      deadProxies: 0,
      workersWithDeadProxies: 0,
    };

    // Start stale claim cleanup task
    this.startStaleClaimCleanup();

    // Start parallel workers
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

  /**
   * Periodically release stale claims to recover from worker crashes
   */
  private async startStaleClaimCleanup(): Promise<void> {
    const cleanupInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(cleanupInterval);
        return;
      }

      try {
        const releasedCount = await this.credentialRepository.releaseStaleClaimsOlderThan(
          this.staleClaimTimeoutMinutes
        );
        if (releasedCount > 0) {
          console.log(`Released ${releasedCount} stale claims`);
        }
      } catch (error) {
        console.error('Error releasing stale claims:', error);
      }
    }, 60000); // Run every minute
  }

  /**
   * Run multiple parallel workers
   */
  private async run(): Promise<void> {
    // Create an array of worker promises
    const workers: Promise<void>[] = [];

    for (let i = 0; i < this.concurrency; i++) {
      const workerId = `worker-${i + 1}`;
      workers.push(this.runWorker(workerId));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    this.isRunning = false;
    this.status.isRunning = false;
    this.status.finishedAt = new Date();
  }

  /**
   * Run a single worker that continuously processes credentials
   */
  private async runWorker(workerId: string): Promise<void> {
    const proxyAssignment = this.workerProxyAssignments.get(workerId);

    if (!proxyAssignment || proxyAssignment.proxies.length === 0) {
      throw new Error(`Worker ${workerId} has no proxies assigned`);
    }

    const proxyListStr = proxyAssignment.proxies.map(p => p.server).join(', ');
    console.log(`Starting ${workerId} with proxies: ${proxyListStr}`);
    this.activeWorkers++;

    try {
      while (this.isRunning) {
        const action = new ScanCredentialsUseCase(
          this.credentialRepository,
          this.verifyService,
          this.uiNotifier,
          {
            batchSize: this.batchSize,
            workerId,
            proxyAssignment,
          }
        );

        const processedCount = await action.execute();
        this.status.processed += processedCount;

        // If no credentials were processed, wait before trying again
        if (processedCount === 0) {
          await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs));
        }
      }
    } catch (error) {
      console.error(`Error in ${workerId}:`, error);
      this.status.lastError = `${workerId}: ${error?.message ?? 'Unknown error'}`;
    } finally {
      this.activeWorkers--;
      console.log(`Stopped ${workerId}`);
    }
  }
}
