import ICredentialRepository from "../../core/repositories/ICredentialRepository";
import { CredentialStatus } from "../../core/value-objects/CredentialStatus";

export default class ExportCredentials {
  constructor(
    private readonly repository: ICredentialRepository,
  ) {}

  async execute(): Promise<string> {
    const credentials = await this.repository.findByStatus(CredentialStatus.ACTIVE);
    
    const lines = credentials.map(credential => 
      `${credential.email}:${credential.password}`
    );
    
    return lines.join('\n');
  }
}
