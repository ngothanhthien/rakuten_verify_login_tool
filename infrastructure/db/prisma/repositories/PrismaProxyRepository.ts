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

      // Edge case: fewer than 1 proxy
      if (totalProxies < 1) {
        return new Map();
      }

      // ALWAYS run with max concurrency (40 workers), regardless of proxy count
      // Each worker gets access to the FULL pool of active proxies
      const maxConcurrency = 40;
      const workerCount = maxConcurrency;
      
      // Fetch ALL active proxies for the pool
      const proxies = await tx.$queryRaw<any[]>`
        SELECT * FROM "Proxy"
        WHERE status = 'ACTIVE'
        ORDER BY id ASC
      `;

      // Distribute FULL proxy list to EVERY worker (Pool Mode)
      const assignments = new Map();
      const proxyEntities = proxies.map(p => this.toEntity(p));

      for (let i = 0; i < workerCount; i++) {
        // Create assignment with ALL proxies
        const assignment = createWorkerProxyAssignment(...proxyEntities);
        
        // Stagger the starting index so workers don't all hit the same proxy at once
        // Worker 1 starts at 0, Worker 2 at 1, etc.
        if (proxyEntities.length > 0) {
            assignment.currentIndex = i % proxyEntities.length;
        }
        
        assignments.set(`worker-${i + 1}`, assignment);
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
