import type IProxyRepository from "../../../../core/repositories/IProxyRepository";
import { prisma } from "../prismaClient";
import { Proxy } from "../../../../core/entities/Proxy";
import type CreateProxyData from "../../../../core/value-objects/CreateProxyData";
import type UpdateProxyData from "../../../../core/value-objects/UpdateProxyData";

type ProxyRow = {
  id: number;
  server: string;
  username: string | null;
  password: string | null;
  status: string;
  usageCount: number;
  usedAt: string | Date | null;
};

export default class PrismaProxyRepository implements IProxyRepository {
  async list(): Promise<Proxy[]> {
    const records = await prisma.$queryRaw<ProxyRow[]>`
      SELECT id, server, username, password, status, usageCount, usedAt FROM "Proxy" ORDER BY updatedAt DESC
    `;
    return records.map(r => this.toEntity(r));
  }

  async findById(id: number): Promise<Proxy | null> {
    const records = await prisma.$queryRaw<ProxyRow[]>`
      SELECT id, server, username, password, status, usageCount, usedAt FROM "Proxy" WHERE id = ${id} LIMIT 1
    `;
    return records[0] ? this.toEntity(records[0]) : null;
  }

  async findByServer(server: string): Promise<Proxy | null> {
    const records = await prisma.$queryRaw<ProxyRow[]>`
      SELECT id, server, username, password, status, usageCount, usedAt
      FROM "Proxy"
      WHERE server = ${server}
      LIMIT 1
    `;
    return records[0] ? this.toEntity(records[0]) : null;
  }

  async create(data: CreateProxyData): Promise<Proxy> {
    await prisma.$executeRaw`
      INSERT INTO "Proxy" ("server", "username", "password", "status", "createdAt", "updatedAt")
      VALUES (${data.server}, ${data.username ?? null}, ${data.password ?? null}, ${data.status ?? "ACTIVE"}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const inserted = await prisma.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() as id`;
    const id = inserted[0]?.id;
    if (!id) {
      throw new Error("Failed to create proxy");
    }

    const created = await this.findById(id);
    if (!created) {
      throw new Error("Failed to load created proxy");
    }

    return created;
  }

  async update(id: number, data: UpdateProxyData): Promise<Proxy> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error("Proxy not found");
    }

    const server = data.server ?? existing.server;
    const username = data.username === undefined ? existing.username : data.username;
    const password = data.password === undefined ? existing.password : data.password;
    const status = data.status ?? existing.status;

    await prisma.$executeRaw`
      UPDATE "Proxy"
      SET "server" = ${server}, "username" = ${username}, "password" = ${password}, "status" = ${status}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    const updated = await this.findById(id);
    return updated!;
  }

  async delete(id: number): Promise<void> {
    await prisma.$executeRaw`DELETE FROM "Proxy" WHERE id = ${id}`;
  }

  async deleteAll(): Promise<number> {
    const result = await prisma.proxy.deleteMany({});
    return result.count;
  }

  async rotate(): Promise<Proxy | null> {
    const updated = await prisma.$queryRaw<ProxyRow[]>`
      UPDATE "Proxy"
      SET
        "usageCount" = "usageCount" + 1,
        "usedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT id
        FROM "Proxy"
        WHERE status = 'ACTIVE'
        ORDER BY ("usedAt" IS NOT NULL) ASC, "usedAt" ASC
        LIMIT 1
      )
      RETURNING id, server, username, password, status, usageCount, usedAt
    `;

    return updated[0] ? this.toEntity(updated[0]) : null;
  }

  private toEntity(model: any) {
    const usedAt = model.usedAt ? new Date(model.usedAt) : null;
    return Proxy.create({
      id: model.id,
      server: model.server,
      username: model.username ?? null,
      password: model.password ?? null,
      status: model.status,
      usageCount: model.usageCount ?? 0,
      usedAt,
    });
  }
}
