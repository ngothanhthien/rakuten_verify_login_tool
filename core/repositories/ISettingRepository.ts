import { Setting } from "../entities/Setting";
import type { SettingProps } from "../entities/Setting";

export default interface ISettingRepository {
  findByKey(key: string): Promise<Setting | null>;
  upsert(setting: SettingProps): Promise<Setting>;
  list(group?: string): Promise<Setting[]>;
}

