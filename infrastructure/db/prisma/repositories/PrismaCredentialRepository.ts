import ICredentialRepository from "../../../../core/repositories/ICredentialRepository";
import { prisma } from "../prismaClient";
import { Credential, CredentialProps } from "../../../../core/entities/Credential";
import { CredentialStatus } from "../../../../core/value-objects/CredentialStatus";
import CreateCredentialData from "../../../../core/value-objects/CreateCredentialData";
import UpdateCredentialData from "../../../../core/value-objects/UpdateCredentialData";
import PaginateQuery from "../../../../core/value-objects/PaginateQuery";
import PaginateResponse from "../../../../core/value-objects/PaginateResponse";
import CredentialListFilter from "../../../../core/value-objects/CredentialListFilter";

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

  private toEntities(model) {
    return Credential.create({
      id: model.id,
      email: model.email,
      password: model.password,
      status: model.status as CredentialStatus,
      checkedAt: model.checkedAt,
    })
  }
}
