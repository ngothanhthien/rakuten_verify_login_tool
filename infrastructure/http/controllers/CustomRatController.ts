import { Request, Response } from 'express';
import { ICustomRatRepository } from '../../../core/repositories/ICustomRatRepository';
import { CustomRat } from '../../../core/repositories/ICustomRatRepository';

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
      const { hash, components } = req.body;

      if (!hash || !components) {
        res.status(400).json({ error: 'hash and components are required' });
        return;
      }

      // Check for duplicate
      const existing = await this.customRatRepository.findByHash(hash);
      if (existing) {
        res.status(409).json({ error: 'RAT with this hash already exists' });
        return;
      }

      const newRat = await this.customRatRepository.add({
        hash,
        components,
        status: 'ACTIVE',
        failureCount: 0
      });

      res.status(201).json(newRat);
    } catch (error) {
      console.error('[CustomRatController] Error adding RAT:', error);
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
