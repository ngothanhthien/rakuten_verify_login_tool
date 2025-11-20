import { asClass, asFunction, createContainer, InjectionMode } from 'awilix'
import PrismaCredentialRepository from './infrastructure/db/prisma/repositories/PrismaCredentialRepository'
import TelegramNotifier from './infrastructure/notifier/TelegramNotifier'
import FileCredentialImportSource from './infrastructure/CredentialImportSource/FileCredentialImportSource'
import PlaywrightVerify from './infrastructure/verifier/PlaywrightVerify'
import CredentialCheckRunner, { CredentialCheckRunnerConfig } from './application/services/CredentialCheckRunner'
import CredentialController from './infrastructure/http/CredentialController'

export function buildContainer() {
  const container = createContainer({
    injectionMode: InjectionMode.CLASSIC
  })

  // Read configuration from environment variables
  const runnerConfig: CredentialCheckRunnerConfig = {
    concurrency: parseInt(process.env.CREDENTIAL_CHECK_CONCURRENCY || '3', 10),
    batchSize: parseInt(process.env.CREDENTIAL_CHECK_BATCH_SIZE || '3', 10),
    pollingIntervalMs: parseInt(process.env.CREDENTIAL_CHECK_POLLING_INTERVAL_MS || '1000', 10),
    staleClaimTimeoutMinutes: parseInt(process.env.CREDENTIAL_CHECK_STALE_TIMEOUT_MINUTES || '10', 10),
  }

  container.register({
    credentialRepository: asClass(PrismaCredentialRepository).scoped(),
    credentialSource: asClass(FileCredentialImportSource).scoped(),
    verifyService: asClass(PlaywrightVerify).scoped(),
    uiNotifier: asClass(TelegramNotifier).scoped(),

    // Register CredentialCheckRunner with configuration
    credentialCheckRunner: asFunction(({ credentialRepository, verifyService, uiNotifier }) => {
      return new CredentialCheckRunner(
        credentialRepository,
        verifyService,
        uiNotifier,
        runnerConfig
      )
    }).singleton(),

    credentialController: asClass(CredentialController).scoped(),
  })

  console.log('CredentialCheckRunner configured with:', runnerConfig)

  return container
}
