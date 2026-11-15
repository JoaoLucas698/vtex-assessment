import { ApiError, NETWORK_ERROR_CODE, UNKNOWN_ERROR_CODE } from '@api/api-error';

interface ErrorBody {
  code?: string;
  message?: string;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorBody = {};
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    // Corpo vazio ou não-JSON (ex.: 413 do servidor): cai nos valores padrão.
  }
  return new ApiError(
    body.code ?? UNKNOWN_ERROR_CODE,
    body.message ?? `Falha na requisição (HTTP ${response.status}).`,
    response.status,
  );
}

/** Único ponto do frontend que chama `fetch`. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(NETWORK_ERROR_CODE, 'Não foi possível falar com o servidor.', 0);
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}