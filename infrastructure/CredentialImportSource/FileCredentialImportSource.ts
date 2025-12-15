import ICredentialSource from "../../application/ports/ICredentialSource";
import RawCredentialData from "../../core/value-objects/RawCredentialData";

export default class FileCredentialImportSource implements ICredentialSource {
  async readAll(file: Express.Multer.File): Promise<RawCredentialData[]> {
    const content = file.buffer.toString('utf-8')

    const lines = content.split('\n').map(l => l.trim()).filter(Boolean)

    const result: RawCredentialData[] = []

    lines.forEach(element => {
      try {
        const [email, password] = element.split(':')
        result.push({
          email: email.trim(),
          password: password.trim(),
        })
      } catch (error) {
        console.error('Error parsing line:', element, error)
      }
    });

    return result
  }
}
