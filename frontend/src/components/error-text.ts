import { ApiError } from '@api/api-error';

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} (${error.code})`;
  return 'Erro inesperado.';
}