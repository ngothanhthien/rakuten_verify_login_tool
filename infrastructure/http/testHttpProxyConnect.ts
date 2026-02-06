import net from "node:net";
import tls from "node:tls";
import { countryLookup } from "../geoip/CountryLookup";

export interface TestProxyOptions {
  proxyServer: string;
  proxyUsername: string | null;
  proxyPassword: string | null;
  timeoutMs?: number;
}

export interface TestProxyResult {
  ok: boolean;
  statusCode?: number;
  ip?: string;
  error?: string;
  elapsedMs: number;
  country?: string | null;
}

export function parseProxyEndpoint(server: string): { host: string; port: number } {
  const trimmed = server.trim();
  if (!trimmed) {
    throw new Error("server is required");
  }

  const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 80;

  if (!host) {
    throw new Error("Invalid proxy server host");
  }
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid proxy server port");
  }

  return { host, port };
}

export function decodeChunkedBody(buffer: Buffer): Buffer {
  let offset = 0;
  const out: Buffer[] = [];

  while (offset < buffer.length) {
    const lineEnd = buffer.indexOf("\r\n", offset);
    if (lineEnd === -1) throw new Error("Invalid chunked encoding");

    const sizeLine = buffer.slice(offset, lineEnd).toString("ascii").trim();
    const sizeHex = sizeLine.split(";", 1)[0] ?? "";
    const size = parseInt(sizeHex, 16);
    if (!Number.isFinite(size) || size < 0) throw new Error("Invalid chunk size");

    offset = lineEnd + 2;
    if (size === 0) break;

    const end = offset + size;
    if (end > buffer.length) throw new Error("Incomplete chunk");

    out.push(buffer.slice(offset, end));
    offset = end + 2; // skip \r\n
  }

  return Buffer.concat(out);
}

export async function testHttpProxyConnect(
  opts: TestProxyOptions,
  fetchCountry: boolean = false
): Promise<TestProxyResult> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const startedAt = Date.now();

  const targetHost = "api.ipify.org";
  const targetPort = 443;
  const targetPath = "/?format=json";

  const { host: proxyHost, port: proxyPort } = parseProxyEndpoint(opts.proxyServer);

  const proxyAuth = opts.proxyUsername
    ? Buffer.from(`${opts.proxyUsername}:${opts.proxyPassword ?? ""}`).toString("base64")
    : null;

  return await new Promise<TestProxyResult>((resolve) => {
    let socket: net.Socket | null = null;
    let secureSocket: tls.TLSSocket | null = null;
    let finished = false;
    let timer: NodeJS.Timeout | null = null;

    // 1. Hàm dọn dẹp và trả về kết quả (đảm bảo chỉ chạy 1 lần)
    const finish = (result: Omit<TestProxyResult, "elapsedMs">) => {
      if (finished) return;
      finished = true;

      // Xóa hard timeout timer
      if (timer) clearTimeout(timer);

      // Hủy kết nối ngay lập tức để tránh treo
      if (socket && !socket.destroyed) socket.destroy();
      if (secureSocket && !secureSocket.destroyed) secureSocket.destroy();

      resolve({ ...result, elapsedMs: Date.now() - startedAt });
    };

    // 2. Thiết lập HARD TIMEOUT (Timeout tổng)
    // Đây là cái giúp bạn tránh bị treo vô tận nếu proxy đơ
    timer = setTimeout(() => {
      finish({ ok: false, error: "Connection timed out (Hard limit)" });
    }, timeoutMs);

    try {
      // 3. Bắt đầu kết nối
      socket = net.connect({ host: proxyHost, port: proxyPort });

      // Vẫn giữ timeout của socket như một lớp bảo vệ phụ (cho idle timeout)
      socket.setTimeout(timeoutMs);

      socket.on("timeout", () => finish({ ok: false, error: "Socket timeout (inactivity)" }));
      socket.on("error", (err) => finish({ ok: false, error: err?.message ?? "Proxy connection error" }));

      socket.on("connect", () => {
        const lines: string[] = [
          `CONNECT ${targetHost}:${targetPort} HTTP/1.1`,
          `Host: ${targetHost}:${targetPort}`,
          `Proxy-Connection: Keep-Alive`,
          `Connection: Keep-Alive`,
        ];

        if (proxyAuth) {
          lines.push(`Proxy-Authorization: Basic ${proxyAuth}`);
        }

        const req = lines.join("\r\n") + "\r\n\r\n";
        socket?.write(req);
      });

      let connectBuffer = Buffer.alloc(0);

      socket.on("data", (chunk) => {
        // Nếu đã finish (ví dụ do timeout) thì không xử lý data nữa
        if (finished) return;

        connectBuffer = Buffer.concat([connectBuffer, chunk]);
        const headerEnd = connectBuffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;

        const headerText = connectBuffer.slice(0, headerEnd).toString("utf8");
        const firstLine = headerText.split("\r\n")[0] ?? "";
        const m = firstLine.match(/HTTP\/\d\.\d\s+(\d+)/i);
        const statusCode = m ? Number(m[1]) : undefined;

        if (statusCode !== 200) {
          return finish({ ok: false, statusCode, error: `Proxy CONNECT failed: ${firstLine || "unknown response"}` });
        }

        // CONNECT thành công, gỡ listener data cũ để chuyển sang TLS
        socket?.removeAllListeners("data");
        socket?.removeAllListeners("timeout"); // Gỡ timeout cũ để set timeout mới cho TLS

        // Tạo kết nối TLS
        secureSocket = tls.connect({
          socket: socket!, // Dấu ! vì chắc chắn socket tồn tại ở đây
          servername: targetHost,
        });

        secureSocket.setTimeout(timeoutMs);
        secureSocket.on("timeout", () => finish({ ok: false, error: "TLS socket timeout" }));
        secureSocket.on("error", (err) => finish({ ok: false, error: err?.message ?? "TLS error" }));

        secureSocket.on("secureConnect", () => {
          const httpReq =
            `GET ${targetPath} HTTP/1.1\r\n` +
            `Host: ${targetHost}\r\n` +
            `Accept: application/json\r\n` +
            `Connection: close\r\n` +
            `\r\n`;

          secureSocket?.write(httpReq);
        });

        const chunks: Buffer[] = [];
        secureSocket.on("data", (d) => chunks.push(Buffer.from(d)));

        secureSocket.on("end", () => {
          if (finished) return;

          const raw = Buffer.concat(chunks);
          if (raw.length === 0) {
             return finish({ ok: false, error: "Empty response from target" });
          }

          const split = raw.indexOf("\r\n\r\n");
          if (split === -1) {
            // Có thể response ngắn hoặc lỗi, thử parse body nếu không tìm thấy header split chuẩn
            // Nhưng an toàn nhất là báo lỗi
            return finish({ ok: false, error: "Invalid response structure" });
          }

          const head = raw.slice(0, split).toString("utf8");
          const bodyRaw = raw.slice(split + 4);
          const statusLine = head.split("\r\n")[0] ?? "";
          const sm = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/i);
          const httpStatus = sm ? Number(sm[1]) : undefined;

          const headers: Record<string, string> = {};
          for (const line of head.split("\r\n").slice(1)) {
            const idx = line.indexOf(":");
            if (idx === -1) continue;
            const k = line.slice(0, idx).trim().toLowerCase();
            const v = line.slice(idx + 1).trim();
            headers[k] = v;
          }

          let body: Buffer = bodyRaw;
          const transferEncoding = headers["transfer-encoding"]?.toLowerCase() ?? "";
          if (transferEncoding.includes("chunked")) {
            try {
              body = decodeChunkedBody(bodyRaw);
            } catch (e: any) {
              return finish({ ok: false, statusCode: httpStatus, error: e?.message ?? "Failed to decode chunked body" });
            }
          }

          if (httpStatus !== 200) {
            return finish({ ok: false, statusCode: httpStatus, error: `Target responded ${httpStatus}` });
          }

          try {
            const json = JSON.parse(body.toString("utf8"));
            const ip = typeof json?.ip === "string" ? json.ip : undefined;
            if (!ip) {
              return finish({ ok: false, statusCode: httpStatus, error: "ipify response missing ip" });
            }

            // If fetchCountry is enabled, look up the country asynchronously
            if (fetchCountry && ip) {
              countryLookup.lookupCountry(ip)
                .then((result) => {
                  finish({ ok: true, statusCode: httpStatus, ip, country: result.country });
                })
                .catch((err) => {
                  console.warn(`[testHttpProxyConnect] Country lookup failed for IP ${ip}:`, err?.message);
                  // Don't fail the proxy test if country lookup fails
                  finish({ ok: true, statusCode: httpStatus, ip, country: null });
                });
            } else {
              return finish({ ok: true, statusCode: httpStatus, ip });
            }
          } catch (e: any) {
            return finish({ ok: false, statusCode: httpStatus, error: e?.message ?? "Failed to parse JSON" });
          }
        });
      });
    } catch (e: any) {
      finish({ ok: false, error: e?.message ?? "Exception during connection setup" });
    }
  });
}
