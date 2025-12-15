import type { Request, Response } from "express";
import SettingService from "../../application/services/SettingService";
import type { SettingType } from "../../core/entities/Setting";

function isSettingType(value: unknown): value is SettingType {
  return value === 'string' || value === 'number' || value === 'boolean' || value === 'json';
}

export default class SettingController {
  constructor(
    private readonly settingService: SettingService,
  ) {}

  async list(req: Request, res: Response) {
    try {
      const group = typeof req.query.group === 'string' ? req.query.group : undefined;
      res.json(await this.settingService.list(group));
    } catch (error) {
      console.error('Error in settings list:', error);
      res.status(500).json({ message: error?.message ?? 'Internal server error' });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const key = typeof req.query.key === 'string' ? req.query.key : '';
      if (!key) {
        return res.status(400).json({ message: 'key is required' });
      }

      const setting = await this.settingService.getByKey(key);
      if (!setting) {
        return res.status(404).json({ message: 'Setting not found' });
      }

      res.json(setting);
    } catch (error) {
      console.error('Error in settings get:', error);
      res.status(500).json({ message: error?.message ?? 'Internal server error' });
    }
  }

  async save(req: Request, res: Response) {
    try {
      const { key, name, value, type, group } = req.body ?? {};

      if (typeof key !== 'string' || !key.trim()) {
        return res.status(400).json({ message: 'key is required' });
      }
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'name is required' });
      }
      if (typeof value !== 'string') {
        return res.status(400).json({ message: 'value must be a string' });
      }
      if (!isSettingType(type)) {
        return res.status(400).json({ message: "type must be one of: string, number, boolean, json" });
      }
      if (typeof group !== 'string' || !group.trim()) {
        return res.status(400).json({ message: 'group is required' });
      }

      const saved = await this.settingService.save({
        key: key.trim(),
        name: name.trim(),
        value,
        type,
        group: group.trim(),
      });

      res.json(saved);
    } catch (error) {
      console.error('Error in settings save:', error);
      res.status(500).json({ message: error?.message ?? 'Internal server error' });
    }
  }
}

