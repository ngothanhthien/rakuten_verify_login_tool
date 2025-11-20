import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import ImportCredentialsUseCase from "../../application/use-cases/ImportCredentials";
import ICredentialSource from "../../application/ports/ICredentialSource";
import type { Request, Response } from 'express'
import { CredentialStatus } from "../../core/value-objects/CredentialStatus";
import CredentialCheckRunner from "../../application/services/CredentialCheckRunner";

export default class CredentialController {
  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly credentialSource: ICredentialSource,
    private readonly credentialCheckRunner: CredentialCheckRunner,
  ) {}

  async import(req: Request, res: Response) {
    try {
      const file = req.file
      if (!file) {
        return res.status(400).json({ message: 'file is required' })
      }
      const action = new ImportCredentialsUseCase(
        this.credentialSource,
        this.credentialRepository
      )
      const result = await action.execute(file)
      res.json(result)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  async list(req: Request, res: Response) {
    try {
      const result = await this.credentialRepository.paginatedList(
        {
          page: Number(req.query.page ?? 1),
          pageSize: Number(req.query.per_page ?? 25),
        },
        {
          status: req.query.status as CredentialStatus | undefined,
          q: req.query.q as string | undefined,
        }
      )
      res.json(result)
    } catch (error) {
      console.error('Error in list:', error)
      res.status(500).json({ message: error.message })
    }
  }

  startCheck(req: Request, res: Response) {
    this.credentialCheckRunner.start()
    res.json({ message: 'Check started' })
  }

  stopCheck(req: Request, res: Response) {
    this.credentialCheckRunner.stop()
    res.json({ message: 'Check stopped' })
  }

  async getCheck(req: Request, res: Response) {
    res.json(await this.credentialCheckRunner.getStatus().isRunning)
  }

  async bulkDelete(req: Request, res: Response) {
    const isRunnerRunning = this.credentialCheckRunner.getStatus().isRunning;

    if (isRunnerRunning) {
      return res.status(400).json({ message: 'Check is running, You need to stop it first' })
    }

    await this.credentialRepository.bulkDelete(req.body.ids)
    res.json({ message: 'Bulk deleted' })
  }
}
