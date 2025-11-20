import RawCredentialData from "../../core/value-objects/RawCredentialData";

export default interface ICredentialSource {
  readAll(): Promise<RawCredentialData[]>;
}
