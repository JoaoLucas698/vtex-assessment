/**
 * Lê as origens liberadas no CORS a partir de `CORS_ORIGINS` (lista separada por vírgula).
 * Variável ausente ou vazia devolve lista vazia: o CORS fica desligado, que é o mais
 * conservador. O frontend não precisa dele porque usa o proxy do Vite ou do nginx (D-120).
 */
export function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
