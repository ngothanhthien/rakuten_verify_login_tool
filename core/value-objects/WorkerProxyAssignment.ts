import { Proxy } from "../entities/Proxy";

export interface WorkerProxyAssignment {
  proxies: Proxy[];
  currentIndex: number;
}

export function createWorkerProxyAssignment(...proxies: Proxy[]): WorkerProxyAssignment {
  return {
    proxies: [...proxies],
    currentIndex: 0
  };
}

export function getNextProxy(assignment: WorkerProxyAssignment): Proxy | null {
  // Return null if no proxies or all are dead
  if (assignment.proxies.length === 0) {
    return null;
  }

  // Start from current index and cycle through to find an alive proxy
  for (let i = 0; i < assignment.proxies.length; i++) {
    const index = (assignment.currentIndex + i) % assignment.proxies.length;
    const proxy = assignment.proxies[index];
    if (proxy.status === 'ACTIVE') {
      return proxy;
    }
  }

  // No alive proxies found
  return null;
}

export function rotateProxyIndex(assignment: WorkerProxyAssignment): void {
  if (assignment.proxies.length > 0) {
    assignment.currentIndex = (assignment.currentIndex + 1) % assignment.proxies.length;
  }
}

export function hasAliveProxy(assignment: WorkerProxyAssignment): boolean {
  return assignment.proxies.some(p => p.status === 'ACTIVE');
}
