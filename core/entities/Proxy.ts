export interface ProxyProps {
  id?: number;
  server: string;
  username?: string | null;
  password?: string | null;
  status?: string;
  country?: string | null;
}

export class Proxy {
  private props: ProxyProps;

  private constructor(props: ProxyProps) {
    this.props = props;
  }

  get id() { return this.props.id; }
  get server() { return this.props.server; }
  get username() { return this.props.username; }
  get password() { return this.props.password; }
  get status() { return this.props.status; }
  get country() { return this.props.country; }

  static create(props: ProxyProps) {
    return new Proxy(props);
  }

  toJSON() {
    return {
      id: this.id,
      server: this.server,
      username: this.username,
      password: this.password,
      status: this.status,
      country: this.country,
    };
  }
}
