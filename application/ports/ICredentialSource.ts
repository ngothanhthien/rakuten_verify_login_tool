import RawCredentialData from "../../core/value-objects/RawCredentialData";

export default interface ICredentialSource {
  readAll(file: Express.Multer.File): Promise<RawCredentialData[]>;
}
