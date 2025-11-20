import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import ICredentialSource from "../ports/ICredentialSource";

export default class ImportCredentials {
  constructor(
    private readonly source: ICredentialSource,
    private readonly repository: ICredentialRepository,
  ) {}

  async execute(file: Express.Multer.File): Promise<{ imported: number; skipped: number }> {
    const rawUsers = await this.source.readAll(file)

    let imported = 0
    let skipped = 0

    for (const raw of rawUsers) {
      if (!raw.email) {
        skipped++
        continue
      }

      const existing = await this.repository.isExists(raw.email)
      if (existing) {
        skipped++
        continue
      }

      await this.repository.create(raw)
      imported++
    }

    return { imported, skipped }
  }
}
