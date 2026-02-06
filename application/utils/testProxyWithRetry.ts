export interface TestResult {
  ok: boolean;
  elapsedMs: number;
  ip?: string;
  error?: string;
}

export async function testProxyWithRetry(
  server: string,
  username: string,
  password: string,
  maxRetries: number = 3,
  maxLatencyMs: number = 2000
): Promise<TestResult> {
  // Import the test function from controller (will need to be extracted)
  // For now, we'll extract testHttpProxyConnect to a shared utility first
  return { ok: true, elapsedMs: 100 }; // Placeholder
}
