import { asClass, createContainer, InjectionMode } from 'awilix'
import PrismaCredentialRepository from './infrastructure/db/prisma/repositories/PrismaCredentialRepository'
import PrismaSettingRepository from './infrastructure/db/prisma/repositories/PrismaSettingRepository'
import PrismaProxyRepository from './infrastructure/db/prisma/repositories/PrismaProxyRepository'
import TelegramNotifier from './infrastructure/notifier/TelegramNotifier'
import FileCredentialImportSource from './infrastructure/CredentialImportSource/FileCredentialImportSource'
import PlaywrightVerify from './infrastructure/verifier/PlaywrightVerify'
import CredentialCheckRunner, { CredentialCheckRunnerConfig } from './application/services/CredentialCheckRunner'
import CredentialController from './infrastructure/http/CredentialController'
import SettingService from './application/services/SettingService'
import SettingController from './infrastructure/http/SettingController'
import ProxyController from './infrastructure/http/ProxyController'

export function buildContainer() {
  const container = createContainer({
    injectionMode: InjectionMode.CLASSIC
  })

  const isDebug = process.env.AUTOMATE_DEBUG === 'true'

  const runnerConfig: CredentialCheckRunnerConfig = {
    concurrency: isDebug ? 1 : parseInt(process.env.CREDENTIAL_CHECK_CONCURRENCY || '6', 10),
    batchSize: parseInt(process.env.CREDENTIAL_CHECK_BATCH_SIZE || '3', 10),
    pollingIntervalMs: parseInt(process.env.CREDENTIAL_CHECK_POLLING_INTERVAL_MS || '1000', 10),
    staleClaimTimeoutMinutes: parseInt(process.env.CREDENTIAL_CHECK_STALE_TIMEOUT_MINUTES || '10', 10),
  }

  container.register({
    credentialRepository: asClass(PrismaCredentialRepository).scoped(),
    settingRepository: asClass(PrismaSettingRepository).scoped(),
    proxyRepository: asClass(PrismaProxyRepository).scoped(),
    credentialSource: asClass(FileCredentialImportSource).scoped(),
    verifyService: asClass(PlaywrightVerify).scoped(),
    uiNotifier: asClass(TelegramNotifier).scoped(),

    settingService: asClass(SettingService).singleton(),

    credentialCheckRunner: asClass(CredentialCheckRunner)
      .inject(() => ({ config: runnerConfig }))
      .singleton(),

    credentialController: asClass(CredentialController).scoped(),
    settingController: asClass(SettingController).scoped(),
    proxyController: asClass(ProxyController).scoped(),
  })

  console.log('CredentialCheckRunner configured with:', runnerConfig)

  return container
}
