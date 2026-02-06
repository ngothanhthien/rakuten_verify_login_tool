import type IProxyRepository from "../../core/repositories/IProxyRepository";
import type CreateProxyData from "../../core/value-objects/CreateProxyData";
import { parseProxyLine, ParsedProxy } from "../utils/parseProxyLine";
import { testProxyWithRetry } from "../utils/testProxyWithRetry";

export interface BulkImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ line: number; raw: string; error: string }>;
}

export default class BulkImportProxies {
  constructor(
    private readonly proxyRepository: IProxyRepository,
  ) {}

  async execute(proxiesText: string, concurrency: number = 5): Promise<BulkImportResult> {
    const lines = proxiesText.split("\n");
    const result: BulkImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Parse all lines first
    const parsed: Array<{ line: number; proxy: ParsedProxy; raw: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const proxy = parseProxyLine(lines[i]);
      if (!proxy.valid) {
        if (lines[i].trim()) {
          result.errors.push({ line: i + 1, raw: lines[i], error: proxy.error || "Invalid" });
          result.skipped++;
        }
      } else {
        parsed.push({ line: i + 1, proxy, raw: lines[i] });
      }
    }

    // Test and import in batches
    for (let i = 0; i < parsed.length; i += concurrency) {
      const batch = parsed.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async ({ line, proxy, raw }) => {
          const testResult = await testProxyWithRetry(proxy.server, proxy.username, proxy.password);

          if (!testResult.ok) {
            result.skipped++;
            result.errors.push({
              line: line,
              raw: raw,
              error: testResult.error || "Test failed",
            });
            return;
          }

          try {
            // Check for existing
            const existing = await this.proxyRepository.findByServer(proxy.server);

            if (existing) {
              await this.proxyRepository.update(existing.id, {
                username: proxy.username,
                password: proxy.password,
              });
              result.updated++;
            } else {
              await this.proxyRepository.create({
                server: proxy.server,
                username: proxy.username,
                password: proxy.password,
                status: "ACTIVE",
              });
              result.created++;
            }
          } catch (dbError: any) {
            result.skipped++;
            result.errors.push({
              line: line,
              raw: raw,
              error: dbError?.message || "Database error",
            });
          }
        })
      );
    }

    return result;
  }
}
