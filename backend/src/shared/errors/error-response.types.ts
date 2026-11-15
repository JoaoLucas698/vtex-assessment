/** Corpo de erro que a API devolve (montado pelo `AllExceptionsFilter`). Também tipa os exemplos do Swagger. */
export interface ErrorResponseBody {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}
