export interface ParsedProxy {
  server: string;
  username: string;
  password: string;
  valid: boolean;
  error?: string;
}

export function parseProxyLine(line: string): ParsedProxy {
  const trimmed = line.trim();
  if (!trimmed) {
    return { server: "", username: "", password: "", valid: false, error: "Empty line" };
  }

  const parts = trimmed.split(":");
  if (parts.length !== 4) {
    return { server: "", username: "", password: "", valid: false, error: "Invalid format, expected ip:port:username:password" };
  }

  const [ip, portStr, username, password] = parts;

  // Validate IP (basic check)
  const ipParts = ip.split(".");
  if (ipParts.length !== 4 || ipParts.some(p => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
    return { server: "", username: "", password: "", valid: false, error: "Invalid IP address" };
  }

  // Validate port
  const port = Number(portStr);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { server: "", username: "", password: "", valid: false, error: "Invalid port number" };
  }

  // Validate username and password are not empty
  if (!username || !password) {
    return { server: "", username: "", password: "", valid: false, error: "Username and password required" };
  }

  const server = `${ip}:${port}`;

  return { server, username, password, valid: true };
}
