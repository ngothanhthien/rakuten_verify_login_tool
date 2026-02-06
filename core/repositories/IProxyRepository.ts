import { Proxy } from "../entities/Proxy";
import type CreateProxyData from "../value-objects/CreateProxyData";
import type UpdateProxyData from "../value-objects/UpdateProxyData";

export default interface IProxyRepository {
  list(): Promise<Proxy[]>;
  findById(id: number): Promise<Proxy | null>;
  findByServer(server: string): Promise<Proxy | null>;
  create(data: CreateProxyData): Promise<Proxy>;
  update(id: number, data: UpdateProxyData): Promise<Proxy>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<number>;  // Returns count of deleted proxies
  rotate(): Promise<Proxy | null>;
}
