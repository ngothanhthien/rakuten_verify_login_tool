import { testHttpProxyConnect } from "../../infrastructure/http/testHttpProxyConnect";

export interface TestResult {
  ok: boolean;
  elapsedMs: number;
  ip?: string;
  error?: string;
  statusCode?: number;
  country?: string | null;
}

export async function testProxyWithRetry(
  server: string,
  username: string,
  password: string,
  maxRetries: number = 3,
  maxLatencyMs: number = 2000,
  fetchCountry: boolean = false
): Promise<TestResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await testHttpProxyConnect({
      proxyServer: server,
      proxyUsername: username,
      proxyPassword: password,
      timeoutMs: maxLatencyMs,
    }, fetchCountry);

    if (result.ok && result.elapsedMs < maxLatencyMs) {
      return result;
    }

    lastError = result.error || `Attempt ${attempt} failed`;
  }

  return { ok: false, elapsedMs: 0, error: lastError };
}
