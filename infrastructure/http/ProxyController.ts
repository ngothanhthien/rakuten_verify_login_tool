import type { Request, Response } from "express";
import type IProxyRepository from "../../core/repositories/IProxyRepository";
import { testHttpProxyConnect, parseProxyEndpoint, decodeChunkedBody } from "./testHttpProxyConnect";
import BulkImportProxies from "../../application/use-cases/BulkImportProxies";

function toOptionalStringOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isProxyStatus(value: unknown): value is "ACTIVE" | "INACTIVE" {
  return value === "ACTIVE" || value === "INACTIVE";
}

export default class ProxyController {
  constructor(
    private readonly proxyRepository: IProxyRepository,
    private readonly bulkImportProxies: BulkImportProxies,
  ) {}

  async list(req: Request, res: Response) {
    try {
      const proxies = await this.proxyRepository.list();
      res.json(proxies.map(p => p.toJSON()));
    } catch (error) {
      console.error("Error in proxies list:", error);
      res.status(500).json({ message: error?.message ?? "Internal server error" });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const id = Number(req.query.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ message: "id is required" });
      }

      const proxy = await this.proxyRepository.findById(id);
      if (!proxy) {
        return res.status(404).json({ message: "Proxy not found" });
      }

      res.json(proxy.toJSON());
    } catch (error) {
      console.error("Error in proxies get:", error);
      res.status(500).json({ message: error?.message ?? "Internal server error" });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id, server, username, password, status } = req.body ?? {};
      const proxyId = Number(id);

      if (!Number.isFinite(proxyId) || proxyId <= 0) {
        return res.status(400).json({ message: "id is required" });
      }

      const serverValue =
        server === undefined
          ? undefined
          : (typeof server === "string" && server.trim() ? server.trim() : null);

      if (serverValue === null) {
        return res.status(400).json({ message: "server must be a non-empty string" });
      }

      if (status !== undefined && !isProxyStatus(status)) {
        return res.status(400).json({ message: "status must be ACTIVE or INACTIVE" });
      }

      const updated = await this.proxyRepository.update(proxyId, {
        server: serverValue ?? undefined,
        username: toOptionalStringOrNull(username),
        password: toOptionalStringOrNull(password),
        status,
      });

      res.json(updated.toJSON());
    } catch (error) {
      console.error("Error in proxies update:", error);
      res.status(500).json({ message: error?.message ?? "Internal server error" });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.body ?? {};
      const proxyId = Number(id);

      if (!Number.isFinite(proxyId) || proxyId <= 0) {
        return res.status(400).json({ message: "id is required" });
      }

      await this.proxyRepository.delete(proxyId);
      res.json({ message: "Proxy deleted" });
    } catch (error) {
      console.error("Error in proxies delete:", error);
      res.status(500).json({ message: error?.message ?? "Internal server error" });
    }
  }

  async test(req: Request, res: Response) {
    try {
      const { id, server, username, password } = req.body ?? {};

      let proxyServer: string;
      let proxyUsername: string | null = null;
      let proxyPassword: string | null = null;
      let proxyStatus: string | undefined;

      if (id !== undefined && id !== null) {
        const proxyId = Number(id);
        if (!Number.isFinite(proxyId) || proxyId <= 0) {
          return res.status(400).json({ message: "id must be a positive number" });
        }

        const proxy = await this.proxyRepository.findById(proxyId);
        if (!proxy) {
          return res.status(404).json({ message: "Proxy not found" });
        }

        proxyServer = proxy.server;
        proxyUsername = proxy.username;
        proxyPassword = proxy.password;
        proxyStatus = proxy.status;
      } else {
        if (typeof server !== "string" || !server.trim()) {
          return res.status(400).json({ message: "server is required" });
        }
        proxyServer = server.trim();
        proxyUsername = toOptionalStringOrNull(username) ?? null;
        proxyPassword = toOptionalStringOrNull(password) ?? null;
      }

      const result = await testHttpProxyConnect({
        proxyServer,
        proxyUsername,
        proxyPassword,
        timeoutMs: 5_000,
      });

      res.json({
        ...result,
        proxy: {
          server: proxyServer,
          username: proxyUsername,
          status: proxyStatus,
        },
        target: "https://api.ipify.org?format=json",
      });
    } catch (error) {
      console.error("Error in proxies test:", error);
      res.status(500).json({ message: error?.message ?? "Internal server error" });
    }
  }

  async bulkImport(req: Request, res: Response) {
    try {
      const { proxies } = req.body ?? {};

      if (typeof proxies !== "string" || !proxies.trim()) {
        return res.status(400).json({ message: "proxies is required and must be a non-empty string" });
      }

      const result = await this.bulkImportProxies.execute(proxies);
      res.json(result);
    } catch (error) {
      console.error("Error in proxies bulkImport:", error);
      res.status(500).json({ message: error?.message ?? "Internal server error" });
    }
  }
}
