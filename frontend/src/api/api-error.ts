/** Erro devolvido pela API (formato do filtro global: statusCode, code, message). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';
export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';