import ICredentialRepository from "../../../../core/repositories/ICredentialRepository";
import { prisma } from "../prismaClient";
import { Credential, CredentialProps } from "../../../../core/entities/Credential";
import { CredentialStatus } from "../../../../core/value-objects/CredentialStatus";
import CreateCredentialData from "../../../../core/value-objects/CreateCredentialData";
import UpdateCredentialData from "../../../../core/value-objects/UpdateCredentialData";
import PaginateQuery from "../../../../core/value-objects/PaginateQuery";
import PaginateResponse from "../../../../core/value-objects/PaginateResponse";
import CredentialListFilter from "../../../../core/value-objects/CredentialListFilter";
import type CredentialStatistics from "../../../../core/value-objects/CredentialStatistics";

export default class PrismaCredentialRepository implements ICredentialRepository {
  async isExists(email: string): Promise<boolean> {
    const existing = await prisma.credential.findUnique({
      where: { email },
    });

    return !!existing;
  }

  async create(data: CreateCredentialData): Promise<Credential> {
    const record = await prisma.credential.create({
      data: {
        email: data.email,
        password: data.password,
      },
    });

    return this.toEntities(record);
  }

  async update(id: number, data: UpdateCredentialData): Promise<Credential> {
    const record = await prisma.credential.update({
      where: { id },
      data: {
        checkedAt: data.checkedAt ?? undefined,
        status: data.status ?? undefined,
      },
    });

    return this.toEntities(record);
  }

  async paginatedList(paginateQuery: PaginateQuery, filter: CredentialListFilter): Promise<PaginateResponse<CredentialProps>> {
    const where = {};

    if (filter.status) {
      where["status"] = filter.status;
    }

    if (filter.q) {
      where["email"] = {
        contains: filter.q,
      };
    }

    const records = await prisma.credential.findMany({
      skip: (paginateQuery.page - 1) * paginateQuery.pageSize,
      take: paginateQuery.pageSize,
      orderBy: {
        updatedAt: "desc",
      },
      where,
    });

    const count = await prisma.credential.count({
      where,
    });

    return {
      data: records.map(this.toEntities).map(credential => credential.toJSON()),
      totalRecords: count,
      totalPages: Math.ceil(count / paginateQuery.pageSize),
      currentPage: paginateQuery.page,
      pageSize: paginateQuery.pageSize,
      hasNextPage: paginateQuery.page < Math.ceil(count / paginateQuery.pageSize),
      hasPreviousPage: paginateQuery.page > 1,
    };
  }

  async findPending(limit: number): Promise<Credential[]> {
    const records = await prisma.credential.findMany({
      where: {
        status: "UNKNOWN",
      },
      take: limit,
      orderBy: {
        createdAt: "asc",
      },
    });
    return records.map(this.toEntities);
  }

  async findByStatus(status: string): Promise<Credential[]> {
    const records = await prisma.credential.findMany({
      where: {
        status: status,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    return records.map(this.toEntities);
  }

  async bulkDelete(ids: number[]): Promise<void> {
    await prisma.credential.deleteMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Delete all credentials that have never been verified and are not currently being processed.
   * Only deletes credentials where:
   * - checkedAt is null (never been verified)
   * - processingBy is null (not currently being processed)
   * - claimedAt is null (not currently claimed by any worker)
   *
   * @returns Number of credentials deleted
   */
  async deleteUnchecked(): Promise<number> {
    const result = await prisma.credential.deleteMany({
      where: {
        checkedAt: null,
        processingBy: null,
        claimedAt: null,
      },
    });

    return result.count;
  }

  async getStatistics(): Promise<CredentialStatistics> {
    const total = await prisma.credential.count();

    const groupByStatus = await prisma.credential.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const byStatus = groupByStatus.map(item => ({
      status: item.status,
      count: item._count.status,
    }));

    return {
      total,
      byStatus,
    };
  }

  /**
   * Atomically find and claim pending credentials for processing.
   * This prevents multiple workers from processing the same credentials.
   *
   * @param limit Maximum number of credentials to claim
   * @param workerId Unique identifier for the worker claiming the credentials
   * @returns Array of claimed credentials
   */
  async findAndClaimPending(limit: number, workerId: string): Promise<Credential[]> {
    // Use a transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
      // Find pending credentials that are not currently being processed
      const pendingCredentials = await tx.credential.findMany({
        where: {
          status: "UNKNOWN",
          processingBy: null,
        },
        take: limit,
        orderBy: {
          createdAt: "asc",
        },
      });

      if (pendingCredentials.length === 0) {
        return [];
      }

      // Claim these credentials by setting processingBy and claimedAt
      const credentialIds = pendingCredentials.map(c => c.id);
      await tx.credential.updateMany({
        where: {
          id: { in: credentialIds },
        },
        data: {
          processingBy: workerId,
          claimedAt: new Date(),
        },
      });

      // Fetch and return the updated credentials
      const claimedCredentials = await tx.credential.findMany({
        where: {
          id: { in: credentialIds },
        },
      });

      return claimedCredentials.map(this.toEntities);
    });
  }

  /**
   * Release the claim on a credential after processing is complete.
   *
   * @param credentialId ID of the credential to release
   */
  async releaseClaim(credentialId: number): Promise<void> {
    await prisma.credential.update({
      where: { id: credentialId },
      data: {
        processingBy: null,
        claimedAt: null,
      },
    });
  }

  /**
   * Release stale claims that have been held for too long.
   * This is a safety mechanism to recover from worker crashes.
   *
   * @param minutes Number of minutes after which a claim is considered stale
   * @returns Number of claims released
   */
  async releaseStaleClaimsOlderThan(minutes: number): Promise<number> {
    const staleThreshold = new Date(Date.now() - minutes * 60 * 1000);

    const result = await prisma.credential.updateMany({
      where: {
        processingBy: { not: null },
        claimedAt: { lt: staleThreshold },
      },
      data: {
        processingBy: null,
        claimedAt: null,
      },
    });

    return result.count;
  }

  private toEntities(model: any) {
    return Credential.create({
      id: model.id,
      email: model.email,
      password: model.password,
      status: model.status as CredentialStatus,
      checkedAt: model.checkedAt,
    })
  }
}
