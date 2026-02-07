import { Request, Response } from 'express';
import { ICustomRatRepository } from '../../../core/repositories/ICustomRatRepository';
import { CustomRat } from '../../../core/repositories/ICustomRatRepository';
import { generateRatHash } from '../../../utils/generateRatHash';

export default class CustomRatController {
  constructor(private customRatRepository: ICustomRatRepository) {}

  async listRats(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const status = req.query.status as 'ACTIVE' | 'DEAD' | undefined;

      const result = await this.customRatRepository.getAll({ page, limit, status });
      res.json({
        rats: result.rats,
        total: result.total,
        page,
        limit
      });
    } catch (error) {
      console.error('[CustomRatController] Error listing RATs:', error);
      res.status(500).json({ error: 'Failed to list RATs' });
    }
  }

  async addRat(req: Request, res: Response): Promise<void> {
    try {
      const { components } = req.body;

      if (!components) {
        res.status(400).json({ error: 'components are required' });
        return;
      }

      // Validate payload size (100KB limit)
      const MAX_COMPONENTS_SIZE = 100_000;
      const componentsJson = JSON.stringify(components);
      if (componentsJson.length > MAX_COMPONENTS_SIZE) {
        res.status(413).json({
          error: `components too large (max ${MAX_COMPONENTS_SIZE} bytes)`
        });
        return;
      }

      // Auto-generate hash from components
      const hash = generateRatHash(components);

      // Use upsert for idempotent behavior
      const rat = await this.customRatRepository.upsert(hash, components);

      res.status(200).json(rat);
    } catch (error) {
      console.error('[CustomRatController] Failed to add RAT:', error);
      res.status(500).json({ error: 'Failed to add RAT' });
    }
  }

  async updateRatStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (status !== 'ACTIVE' && status !== 'DEAD') {
        res.status(400).json({ error: 'status must be ACTIVE or DEAD' });
        return;
      }

      const rat = await this.customRatRepository.getById(Number(id));
      if (!rat) {
        res.status(404).json({ error: 'RAT not found' });
        return;
      }

      const updatedRat = await this.customRatRepository.updateStatus(Number(id), status);
      res.json(updatedRat);
    } catch (error) {
      console.error('[CustomRatController] Error updating RAT status:', error);
      res.status(500).json({ error: 'Failed to update RAT status' });
    }
  }

  async deleteRat(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const rat = await this.customRatRepository.getById(Number(id));
      if (!rat) {
        res.status(404).json({ error: 'RAT not found' });
        return;
      }

      await this.customRatRepository.delete(Number(id));
      res.json({ success: true });
    } catch (error) {
      console.error('[CustomRatController] Error deleting RAT:', error);
      res.status(500).json({ error: 'Failed to delete RAT' });
    }
  }
}
