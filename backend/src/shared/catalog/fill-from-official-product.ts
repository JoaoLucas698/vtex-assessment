/** Campos que o seller pode deixar sem informar e que o produto oficial também tem. */
export interface FallbackFields {
  readonly brand: string | null;
  readonly category: string | null;
}

/**
 * D-014: o banco guarda `null` quando o seller não informou `brand`/`category`.
 * Na leitura, cada campo `null` usa o valor do produto oficial do catálogo.
 * Só `null` cai para o oficial: texto do seller, mesmo vazio, fica como veio.
 * Função pura; devolve um objeto novo com os outros campos intactos.
 */
export function fillFromOfficialProduct<T extends FallbackFields>(
  sellerData: T,
  official: FallbackFields,
): T {
  return {
    ...sellerData,
    brand: sellerData.brand ?? official.brand,
    category: sellerData.category ?? official.category,
  };
}
