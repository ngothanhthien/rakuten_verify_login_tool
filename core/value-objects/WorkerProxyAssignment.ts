import { Proxy } from "../entities/Proxy";

export interface WorkerProxyAssignment {
  proxy1: Proxy | null;
  proxy2: Proxy | null;
  currentIndex: 0 | 1;
}

export function createWorkerProxyAssignment(
  proxy1: Proxy | null,
  proxy2: Proxy | null
): WorkerProxyAssignment {
  return {
    proxy1,
    proxy2,
    currentIndex: 0
  };
}

export function getNextProxy(assignment: WorkerProxyAssignment): Proxy | null {
  return assignment.currentIndex === 0 ? assignment.proxy1 : assignment.proxy2;
}

export function rotateProxyIndex(assignment: WorkerProxyAssignment): void {
  if (assignment.proxy1 && assignment.proxy2) {
    assignment.currentIndex = assignment.currentIndex === 0 ? 1 : 0;
  }
}

export function hasAliveProxy(assignment: WorkerProxyAssignment): boolean {
  return (assignment.proxy1?.status === 'ACTIVE') ||
         (assignment.proxy2?.status === 'ACTIVE');
}
