import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import ImportCredentialsUseCase from "../../application/use-cases/ImportCredentials";
import ICredentialSource from "../../application/ports/ICredentialSource";
import type { Request, Response } from 'express'
import { CredentialStatus } from "../../core/value-objects/CredentialStatus";
import CredentialCheckRunner from "../../application/services/CredentialCheckRunner";

export default class {
  constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly credentialSource: ICredentialSource,
    private readonly credentialCheckRunner: CredentialCheckRunner,
  ) {}

  async import(req: Request, res: Response) {
    try {
      const action = new ImportCredentialsUseCase(
        this.credentialSource,
        this.credentialRepository
      )
      const result = await action.execute()
      res.json(result)
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' })
    }
  }

  list(req: Request, res: Response) {
    res.json(this.credentialRepository.paginatedList(
      {
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 25),
      },
      {
        status: req.query.status as CredentialStatus | undefined,
        q: req.query.q as string | undefined,
      }
    ))
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
    res.json(await this.credentialCheckRunner.getStatus())
  }

  async bulkDelete(req: Request, res: Response) {
    const isRunnerRunning = this.credentialCheckRunner.getStatus();

    if (isRunnerRunning) {
      return res.status(400).json({ message: 'Check is running, You need to stop it first' })
    }

    await this.credentialRepository.bulkDelete(req.body.ids)
    res.json({ message: 'Bulk deleted' })
  }
}
