/** Tipos e limites de paginação, compartilhados por todos os módulos (D-060). */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Página pedida: `page` começa em 1. */
export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

/** O que um repository devolve numa listagem paginada. */
export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
}

/** O que um usecase devolve numa listagem paginada. */
export type PaginatedOutput<T> = PaginatedResult<T> & PaginationParams;
