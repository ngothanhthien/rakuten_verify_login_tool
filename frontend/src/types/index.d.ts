export type CredentialStatus = 'UNKNOWN' | 'VALID' | 'INVALID';

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
