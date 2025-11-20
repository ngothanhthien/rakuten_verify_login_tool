import { CredentialStatus } from "../value-objects/CredentialStatus";

export interface CredentialProps {
  id: number;
  email: string;
  password: string;
  status: CredentialStatus;
  checkedAt: Date | null;
}

export class Credential {
  private props: CredentialProps;

  private constructor(props: CredentialProps) {
    this.props = props;
  }

  get id()         { return this.props.id; }
  get email()   { return this.props.email; }
  get password()   { return this.props.password; }
  get status()       { return this.props.status; }
  get checkedAt()    { return this.props.checkedAt; }
  static create(props: CredentialProps) {
    return new Credential(props);
  }
}
