export type CredentialStatus = 'UNKNOWN' | 'ACTIVE' | 'INACTIVE';

export interface Credential {
  id: number;
  email: string;
  password: string;
  status: CredentialStatus;
  checkedAt: string | null;
}

export interface Pagination<T> {
  data: T[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationProps {
  totalPages: number
  totalRows: number
  totalSelectedRows?: number
}

export interface QueryParams {
  [key: string]: string | number | undefined | string[] | number[]
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface CredentialStatistics {
  total: number;
  byStatus: StatusCount[];
}

export type SettingType = 'string' | 'number' | 'boolean' | 'json';

export interface Setting {
  key: string;
  name: string;
  value: string;
  type: SettingType;
  group: string;
}

export interface Proxy {
  id: number;
  server: string;
  username: string | null;
  password: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  country?: string | null;
}
