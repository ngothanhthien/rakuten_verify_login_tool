import type ISettingRepository from "../../../../core/repositories/ISettingRepository";
import { prisma } from "../prismaClient";
import { Setting, type SettingProps, type SettingType } from "../../../../core/entities/Setting";

export default class PrismaSettingRepository implements ISettingRepository {
  async findByKey(key: string): Promise<Setting | null> {
    const record = await prisma.setting.findUnique({
      where: { key },
    });

    return record ? this.toEntity(record) : null;
  }

  async upsert(setting: SettingProps): Promise<Setting> {
    const record = await prisma.setting.upsert({
      where: { key: setting.key },
      create: {
        key: setting.key,
        name: setting.name,
        value: setting.value,
        type: setting.type,
        group: setting.group,
      },
      update: {
        name: setting.name,
        value: setting.value,
        type: setting.type,
        group: setting.group,
      },
    });

    return this.toEntity(record);
  }

  async list(group?: string): Promise<Setting[]> {
    const records = await prisma.setting.findMany({
      where: group ? { group } : undefined,
      orderBy: [
        { group: 'asc' },
        { key: 'asc' },
      ],
    });

    return records.map(r => this.toEntity(r));
  }

  private toEntity(model: any) {
    return Setting.create({
      key: model.key,
      name: model.name,
      value: model.value,
      type: model.type as SettingType,
      group: model.group,
    });
  }
}

