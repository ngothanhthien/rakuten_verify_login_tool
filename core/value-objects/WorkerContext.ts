import { WorkerProxyAssignment } from "./WorkerProxyAssignment";

export interface WorkerContext {
  workerId: string;
  proxyAssignment: WorkerProxyAssignment;
}

export function createWorkerContext(
  workerId: string,
  proxyAssignment: WorkerProxyAssignment
): WorkerContext {
  return {
    workerId,
    proxyAssignment
  };
}
