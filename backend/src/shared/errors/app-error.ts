/** Tipo base dos erros de negócio retornados via `Result.error(...)`. */
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}
