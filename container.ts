import { asClass, asValue, createContainer, InjectionMode } from 'awilix'
import PrismaCredentialRepository from './infrastructure/db/prisma/repositories/PrismaCredentialRepository'
import WebsocketNotifier from './infrastructure/notifier/WebsocketNotifier'
import FileCredentialImportSource from './infrastructure/CredentialImportSource/FileCredentialImportSource'
import PlaywrightVerify from './infrastructure/verifier/PlaywrightVerify'
import CredentialCheckRunner from './application/services/CredentialCheckRunner'
import CredentialController from './infrastructure/http/CredentialController'

export function buildContainer() {
  const container = createContainer({
    injectionMode: InjectionMode.CLASSIC
  })

  container.register({
    credentialRepository: asClass(PrismaCredentialRepository).scoped(),
    credentialSource: asClass(FileCredentialImportSource).scoped(),
    verifyService: asClass(PlaywrightVerify).scoped(),
    uiNotifier: asClass(WebsocketNotifier).scoped(),

    credentialCheckRunner: asClass(CredentialCheckRunner).singleton(),
    credentialController: asClass(CredentialController).scoped(),
  })

  return container
}
