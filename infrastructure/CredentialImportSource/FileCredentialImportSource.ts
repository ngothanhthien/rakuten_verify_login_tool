import path from "path";
import ICredentialSource from "../../application/ports/ICredentialSource";
import RawCredentialData from "../../core/value-objects/RawCredentialData";
import fs from 'fs/promises'

export default class implements ICredentialSource {
  constructor(private readonly filePath: string) {}

  async readAll(): Promise<RawCredentialData[]> {
    const absPath = path.resolve(this.filePath)
    const content = await fs.readFile(absPath, 'utf8')

    const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
    const [headerLine, ...rows] = lines
    const headers = headerLine.split(',').map(h => h.trim())

    const records: RawCredentialData[] = []

    for (const row of rows) {
      const values = row.split(',').map(v => v.trim())
      const obj: any = {}
      headers.forEach((h, i) => { obj[h] = values[i] })

      records.push({
        email: obj.email,
        password: obj.password,
      })
    }

    return records
  }
}
