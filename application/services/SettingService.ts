import type ISettingRepository from "../../core/repositories/ISettingRepository";
import type { Setting, SettingProps } from "../../core/entities/Setting";

export default class SettingService {
  cachedSettings: Record<string, Setting> = {};

  constructor(
    private readonly settingRepository: ISettingRepository,
  ) {}

  async getByKey(key: string) {
    if (this.cachedSettings[key]) {
      return this.cachedSettings[key].toJSON();
    }

    const setting = await this.settingRepository.findByKey(key);
    if (setting) {
      this.cachedSettings[key] = setting;
    }
    return setting?.toJSON() ?? null;
  }

  async save(setting: SettingProps) {
    const saved = await this.settingRepository.upsert(setting);
    return saved.toJSON();
  }

  async list(group?: string) {
    const settings = await this.settingRepository.list(group);
    return settings.map(s => s.toJSON());
  }
}
