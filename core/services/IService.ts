export interface IService {
  check(credential: Credential): Promise<boolean>
}
