import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import PrismaCredentialRepository from './infrastructure/db/prisma/repositories/PrismaCredentialRepository'
import PrismaSettingRepository from './infrastructure/db/prisma/repositories/PrismaSettingRepository'
import PrismaProxyRepository from './infrastructure/db/prisma/repositories/PrismaProxyRepository'
import PrismaCustomRatRepository from './infrastructure/db/prisma/repositories/PrismaCustomRatRepository'
import TelegramNotifier from './infrastructure/notifier/TelegramNotifier'
import FileCredentialImportSource from './infrastructure/CredentialImportSource/FileCredentialImportSource'
import PlaywrightVerify from './infrastructure/verifier/PlaywrightVerify'
import CredentialCheckRunner, { CredentialCheckRunnerConfig } from './application/services/CredentialCheckRunner'
import BulkImportProxies from './application/use-cases/BulkImportProxies'
import CredentialController from './infrastructure/http/CredentialController'
import SettingService from './application/services/SettingService'
import SettingController from './infrastructure/http/SettingController'
import ProxyController from './infrastructure/http/ProxyController'
import { fetchGistAsCustomRat } from './utils'
import type { CustomRat } from './utils/ratOverride'

const CUSTOM_RAT_GIST_URL = 'https://gist.githubusercontent.com/ngothanhthien/8a5052719043523b9f1061a2a2be8697/raw'

export async function buildContainer() {
  const container = createContainer({
    injectionMode: InjectionMode.CLASSIC
  })

  const isDebug = process.env.AUTOMATE_DEBUG === 'true'

  // Load custom RAT once at startup (wire layer)
  let customRat: CustomRat | null = null
  try {
    customRat = await fetchGistAsCustomRat(CUSTOM_RAT_GIST_URL + '?v=' + Date.now())
    console.log('[WireLayer] Custom RAT loaded from gist:', customRat.hash)
  } catch (error) {
    console.error('[WireLayer] Failed to load custom RAT from gist:', error)
  }

  const runnerConfig: CredentialCheckRunnerConfig = {
    concurrency: isDebug ? 1 : 40,
    batchSize: parseInt(process.env.CREDENTIAL_CHECK_BATCH_SIZE || '3', 10),
    pollingIntervalMs: parseInt(process.env.CREDENTIAL_CHECK_POLLING_INTERVAL_MS || '1000', 10),
    staleClaimTimeoutMinutes: parseInt(process.env.CREDENTIAL_CHECK_STALE_TIMEOUT_MINUTES || '10', 10),
  }

  container.register({
    credentialRepository: asClass(PrismaCredentialRepository).scoped(),
    settingRepository: asClass(PrismaSettingRepository).scoped(),
    proxyRepository: asClass(PrismaProxyRepository).scoped(),
    customRatRepository: asClass(PrismaCustomRatRepository).scoped(),
    credentialSource: asClass(FileCredentialImportSource).scoped(),
    verifyService: asClass(PlaywrightVerify).scoped(),
    uiNotifier: asClass(TelegramNotifier).scoped(),

    // Register custom RAT as singleton value (loaded once at startup)
    customRat: asValue(customRat),

    settingService: asClass(SettingService).singleton(),

    bulkImportProxies: asClass(BulkImportProxies).scoped(),

    credentialCheckRunner: asClass(CredentialCheckRunner)
      .inject((cradle: any) => ({
        ...cradle,
        config: runnerConfig
      }))
      .singleton(),

    credentialController: asClass(CredentialController).scoped(),
    settingController: asClass(SettingController).scoped(),
    proxyController: asClass(ProxyController).scoped(),
  })

  console.log('CredentialCheckRunner configured with:', runnerConfig)

  return container
}
