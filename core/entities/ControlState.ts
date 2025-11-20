export interface ControlStateProps {
  isRunning: boolean;
}

export class ControlState {
  private props: ControlStateProps;

  constructor(props: ControlStateProps) {
    this.props = props;
  }

  get isRunning() {
    return this.props.isRunning;
  }

  static create(props: ControlStateProps) {
    return new ControlState(props);
  }
}
