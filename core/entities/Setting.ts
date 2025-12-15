export type SettingType = 'string' | 'number' | 'boolean' | 'json';

export interface SettingProps {
  key: string;
  name: string;
  value: string;
  type: SettingType;
  group: string;
}

export class Setting {
  private props: SettingProps;

  private constructor(props: SettingProps) {
    this.props = props;
  }

  get key() { return this.props.key; }
  get name() { return this.props.name; }
  get value() { return this.props.value; }
  get type() { return this.props.type; }
  get group() { return this.props.group; }

  static create(props: SettingProps) {
    return new Setting(props);
  }

  toJSON() {
    return {
      key: this.key,
      name: this.name,
      value: this.value,
      type: this.type,
      group: this.group,
    };
  }
}

