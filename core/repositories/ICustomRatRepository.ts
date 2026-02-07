import { CustomRat as PrismaCustomRat } from '@prisma/client';

export interface CustomRat {
  id: number;
  hash: string;
  components: any; // RatComponents parsed from JSON
  status: 'ACTIVE' | 'DEAD';
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomRatListFilters {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'DEAD';
}

export interface ICustomRatRepository {
  getActiveRats(): Promise<CustomRat[]>;
  findByHash(hash: string): Promise<CustomRat | null>;
  getById(id: number): Promise<CustomRat | null>;
  incrementFailureCount(id: number): Promise<CustomRat>;
  markAsDead(id: number): Promise<CustomRat>;
  markAsDeadByHash(hash: string): Promise<CustomRat | null>;
  resetFailureCount(hash: string): Promise<void>;
  reactivateRat(id: number): Promise<CustomRat>;
  add(data: Omit<CustomRat, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomRat>;
  getAll(filters?: CustomRatListFilters): Promise<{ rats: CustomRat[]; total: number }>;
  delete(id: number): Promise<void>;
  updateStatus(id: number, status: 'ACTIVE' | 'DEAD'): Promise<CustomRat>;
}
