export interface StatusCount {
  status: string;
  count: number;
}

export default interface CredentialStatistics {
  total: number;
  byStatus: StatusCount[];
}
