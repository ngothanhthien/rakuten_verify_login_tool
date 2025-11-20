import { asClass, createContainer } from 'awilix'
import PrismaCredentialRepository from './infrastructure/db/prisma/repositories/PrismaCredentialRepository'
import WebsocketNotifier from './infrastructure/notifier/WebsocketNotifier'
import CredentialSource from './infrastructure/CredentialImportSource/FileCredentialImportSource'
import PlaywrightVerify from './infrastructure/verifier/PlaywrightVerify'
import CredentialCheckRunner from './application/services/CredentialCheckRunner'

export function buildContainer() {
  const container = createContainer()

  container.register({
    credentialRepository: asClass(PrismaCredentialRepository).scoped(),
    credentialSource: asClass(CredentialSource).scoped(),
    verifyService: asClass(PlaywrightVerify).scoped(),
    uiNotifier: asClass(WebsocketNotifier).scoped(),

    credentialCheckRunner: asClass(CredentialCheckRunner).singleton(),
  })

  return container
}
