import { ICustomRatRepository, CustomRat, CustomRatListFilters } from '../../../../core/repositories/ICustomRatRepository';
import { prisma } from '../prismaClient';
import { CustomRat as PrismaCustomRat } from '@prisma/client';

export default class PrismaCustomRatRepository implements ICustomRatRepository {

  private toDomain(prismaRat: PrismaCustomRat): CustomRat {
    return {
      id: prismaRat.id,
      hash: prismaRat.hash,
      components: JSON.parse(prismaRat.components),
      status: prismaRat.status as 'ACTIVE' | 'DEAD',
      failureCount: prismaRat.failureCount,
      createdAt: prismaRat.createdAt,
      updatedAt: prismaRat.updatedAt
    };
  }

  async getActiveRats(): Promise<CustomRat[]> {
    const rats = await prisma.customRat.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' }
    });
    return rats.map(r => this.toDomain(r));
  }

  async findByHash(hash: string): Promise<CustomRat | null> {
    const rat = await prisma.customRat.findUnique({
      where: { hash }
    });
    return rat ? this.toDomain(rat) : null;
  }

  async getById(id: number): Promise<CustomRat | null> {
    const rat = await prisma.customRat.findUnique({
      where: { id }
    });
    return rat ? this.toDomain(rat) : null;
  }

  async incrementFailureCount(id: number): Promise<CustomRat> {
    const rat = await prisma.customRat.update({
      where: { id },
      data: { failureCount: { increment: 1 } }
    });
    return this.toDomain(rat);
  }

  async markAsDead(id: number): Promise<CustomRat> {
    const rat = await prisma.customRat.update({
      where: { id },
      data: { status: 'DEAD' }
    });
    return this.toDomain(rat);
  }

  async markAsDeadByHash(hash: string): Promise<CustomRat | null> {
    try {
      const rat = await prisma.customRat.update({
        where: { hash },
        data: { status: 'DEAD' }
      });
      return this.toDomain(rat);
    } catch {
      return null;
    }
  }

  async resetFailureCount(hash: string): Promise<void> {
    await prisma.customRat.update({
      where: { hash },
      data: { failureCount: 0 }
    });
  }

  async reactivateRat(id: number): Promise<CustomRat> {
    const rat = await prisma.customRat.update({
      where: { id },
      data: { status: 'ACTIVE', failureCount: 0 }
    });
    return this.toDomain(rat);
  }

  async add(data: Omit<CustomRat, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomRat> {
    const rat = await prisma.customRat.create({
      data: {
        hash: data.hash,
        components: JSON.stringify(data.components),
        status: data.status || 'ACTIVE',
        failureCount: data.failureCount || 0
      }
    });
    return this.toDomain(rat);
  }

  async getAll(filters?: CustomRatListFilters): Promise<{ rats: CustomRat[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where = filters?.status ? { status: filters.status } : {};

    const [rats, total] = await Promise.all([
      prisma.customRat.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.customRat.count({ where })
    ]);

    return {
      rats: rats.map(r => this.toDomain(r)),
      total
    };
  }

  async delete(id: number): Promise<void> {
    await prisma.customRat.delete({
      where: { id }
    });
  }

  async updateStatus(id: number, status: 'ACTIVE' | 'DEAD'): Promise<CustomRat> {
    const rat = await prisma.customRat.update({
      where: { id },
      data: { status }
    });
    return this.toDomain(rat);
  }
}
