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
  country: string | null;
};

export default class PrismaProxyRepository implements IProxyRepository {
  async list(): Promise<Proxy[]> {
    const records = await prisma.$queryRaw<ProxyRow[]>`
      SELECT id, server, username, password, status, country FROM "Proxy" ORDER BY updatedAt DESC
    `;
    return records.map(r => this.toEntity(r));
  }

  async findById(id: number): Promise<Proxy | null> {
    const records = await prisma.$queryRaw<ProxyRow[]>`
      SELECT id, server, username, password, status, country FROM "Proxy" WHERE id = ${id} LIMIT 1
    `;
    return records[0] ? this.toEntity(records[0]) : null;
  }

  async findByServer(server: string): Promise<Proxy | null> {
    const records = await prisma.$queryRaw<ProxyRow[]>`
      SELECT id, server, username, password, status, country
      FROM "Proxy"
      WHERE server = ${server}
      LIMIT 1
    `;
    return records[0] ? this.toEntity(records[0]) : null;
  }

  async create(data: CreateProxyData): Promise<Proxy> {
    await prisma.$executeRaw`
      INSERT INTO "Proxy" ("server", "username", "password", "status", "country", "createdAt", "updatedAt")
      VALUES (${data.server}, ${data.username ?? null}, ${data.password ?? null}, ${data.status ?? "ACTIVE"}, ${data.country ?? null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
    const country = data.country === undefined ? existing.country : data.country;

    await prisma.$executeRaw`
      UPDATE "Proxy"
      SET "server" = ${server}, "username" = ${username}, "password" = ${password}, "status" = ${status}, "country" = ${country}, "updatedAt" = CURRENT_TIMESTAMP
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

  async rotate(oldProxyId: number, newProxyId: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Set old proxy back to ACTIVE
      await tx.$queryRaw`
        UPDATE "Proxy"
        SET status = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${oldProxyId}
      `;

      // Set new proxy to IN_USE
      await tx.$queryRaw`
        UPDATE "Proxy"
        SET status = 'IN_USE', "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${newProxyId}
      `;
    });
  }

  async getActiveCount(): Promise<number> {
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Proxy"
      WHERE status = 'ACTIVE'
    `;
    return Number(result[0].count);
  }

  async getTotalCount(): Promise<number> {
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "Proxy"
    `;
    return Number(result[0].count);
  }

  async markProxyDead(proxyId: number): Promise<void> {
    await prisma.proxy.update({
      where: { id: proxyId },
      data: {
        status: 'DEAD',
        updatedAt: new Date()
      }
    });
  }

  async assignToWorkers(): Promise<Map<string, import("../../../../core/value-objects/WorkerProxyAssignment").WorkerProxyAssignment>> {
    const { createWorkerProxyAssignment } = await import('../../../../core/value-objects/WorkerProxyAssignment');

    return await prisma.$transaction(async (tx) => {
      // Count total active proxies
      const countResult = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "Proxy" WHERE status = 'ACTIVE'
      `;
      const totalProxies = Number(countResult[0].count);

      // Edge case: fewer than 2 proxies means no workers
      if (totalProxies < 2) {
        return new Map();
      }

      // Calculate optimal worker count: MIN(totalProxies / 2, 40)
      // Then distribute proxies evenly: proxiesPerWorker = CEIL(totalProxies / workerCount)
      const maxConcurrency = 40;
      const workerCount = Math.min(Math.floor(totalProxies / 2), maxConcurrency);
      const proxiesPerWorker = Math.ceil(totalProxies / workerCount);

      // Fetch the proxies we need
      const requiredProxies = workerCount * proxiesPerWorker;
      const proxies = await tx.$queryRaw<any[]>`
        SELECT * FROM "Proxy"
        WHERE status = 'ACTIVE'
        ORDER BY id ASC
        LIMIT ${requiredProxies}
      `;

      // Distribute proxies evenly across workers
      const assignments = new Map();
      for (let i = 0; i < workerCount; i++) {
        const start = i * proxiesPerWorker;
        const end = start + proxiesPerWorker;
        const workerProxies = proxies.slice(start, end)
          .map(p => this.toEntity(p));

        assignments.set(`worker-${i + 1}`, createWorkerProxyAssignment(...workerProxies));
      }

      return assignments;
    });
  }

  private toEntity(model: any) {
    return Proxy.create({
      id: model.id,
      server: model.server,
      username: model.username,
      password: model.password,
      status: model.status,
      country: model.country
    });
  }
}
