/**
 * Lê as origens liberadas no CORS a partir de `CORS_ORIGINS` (lista separada por vírgula).
 * Variável ausente ou vazia devolve lista vazia: o CORS fica desligado, que é o mais
 * conservador (D-036).
 */
export function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
