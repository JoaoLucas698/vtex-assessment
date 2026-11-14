import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ExistingProductRef,
  ExistingSellerLink,
  ImportItemOutcome,
  MatchDecisionType,
  MatchedBy,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { ProductMatchingService } from '@modules/catalog-import/services/product-matching.service';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';

/** Formato de cada item de `database/fixtures/carga.json`. */
interface CargaItem {
  Id: string | null;
  SellerName: string | null;
  Name: string | null;
  Brand: string | null;
  Category: string | null;
}

interface SimulatedLink extends ExistingSellerLink {
  readonly sellerName: string;
  readonly matchedBy: MatchedBy;
}

const CARGA_PATH = resolve(
  __dirname,
  '../../../../../database/fixtures/carga.json',
);

const isBlank = (value: string | null | undefined): boolean =>
  !value || !value.trim();

/**
 * Simula a importação de `carga.json` com catálogo vazio, usando os dois services
 * reais e estruturas em memória no lugar do banco. Reproduz o que o usecase faz:
 * busca os dados, pede a decisão e "grava" item a item, para que o próximo item
 * já enxergue o produto criado (dedupe dentro do arquivo).
 *
 * Os números esperados são os de `docs/context.md` §8.
 */
describe('Simulação do matching com database/fixtures/carga.json (catálogo vazio)', () => {
  const normalizer = new ProductNormalizerService();
  const matching = new ProductMatchingService();

  const items = JSON.parse(readFileSync(CARGA_PATH, 'utf8')) as CargaItem[];

  const productsByKey = new Map<string, ExistingProductRef>();
  const links: SimulatedLink[] = [];
  const linksByExternalId = new Map<string, SimulatedLink>();
  const linksBySellerProduct = new Map<string, SimulatedLink>();
  const outcomes = new Map<ImportItemOutcome, number>();

  const count = (outcome: ImportItemOutcome): void => {
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
  };

  const createLink = (
    sellerName: string,
    externalId: string,
    productId: number,
    matchedBy: MatchedBy,
  ): void => {
    const created: SimulatedLink = {
      id: links.length + 1,
      productId,
      externalId,
      sellerName,
      matchedBy,
    };
    links.push(created);
    linksByExternalId.set(`${sellerName}\u0000${externalId}`, created);
    linksBySellerProduct.set(`${sellerName}\u0000${productId}`, created);
  };

  for (const item of items) {
    if (isBlank(item.Id) || isBlank(item.SellerName) || isBlank(item.Name)) {
      count(ImportItemOutcome.INVALID);
      continue;
    }
    const sellerName = item.SellerName as string;
    const externalId = item.Id as string;
    const key = normalizer.buildKey(item.Brand, item.Name as string);

    const productByKey = productsByKey.get(key) ?? null;
    const decision = matching.decide({
      linkByExternalId:
        linksByExternalId.get(`${sellerName}\u0000${externalId}`) ?? null,
      productByKey,
      sellerLinkToProduct: productByKey
        ? (linksBySellerProduct.get(`${sellerName}\u0000${productByKey.id}`) ??
          null)
        : null,
    });

    switch (decision.type) {
      case MatchDecisionType.CREATE_PRODUCT: {
        const product = { id: productsByKey.size + 1 };
        productsByKey.set(key, product);
        createLink(sellerName, externalId, product.id, decision.matchedBy);
        break;
      }
      case MatchDecisionType.LINK_EXISTING:
        createLink(
          sellerName,
          externalId,
          decision.productId,
          decision.matchedBy,
        );
        break;
      case MatchDecisionType.ALREADY_LINKED:
      case MatchDecisionType.DUPLICATE_SAME_SELLER:
        break;
    }
    count(matching.toOutcome(decision));
  }

  it('lê 269 itens, nenhum inválido', () => {
    expect(items).toHaveLength(269);
    expect(outcomes.get(ImportItemOutcome.INVALID) ?? 0).toBe(0);
  });

  it('cria 201 produtos (new) e liga 56 itens a produtos existentes (normalized_key)', () => {
    expect(outcomes.get(ImportItemOutcome.CREATED)).toBe(201);
    expect(productsByKey.size).toBe(201);
    expect(outcomes.get(ImportItemOutcome.LINKED_EXISTING)).toBe(56);
    expect(links.filter((l) => l.matchedBy === MatchedBy.NEW)).toHaveLength(
      201,
    );
    expect(
      links.filter((l) => l.matchedBy === MatchedBy.NORMALIZED_KEY),
    ).toHaveLength(56);
  });

  it('reporta 1 já vinculado e 11 duplicados no mesmo seller', () => {
    expect(outcomes.get(ImportItemOutcome.ALREADY_LINKED)).toBe(1);
    expect(outcomes.get(ImportItemOutcome.DUPLICATE_SAME_SELLER)).toBe(11);
  });

  it('gera 257 vínculos, sem repetir (seller, produto) nem (seller, externalId)', () => {
    expect(links).toHaveLength(257);
    expect(linksBySellerProduct.size).toBe(257);
    expect(linksByExternalId.size).toBe(257);
  });

  it('deixa 54 produtos vendidos por mais de 1 seller', () => {
    const sellersByProduct = new Map<number, Set<string>>();
    for (const l of links) {
      const sellers = sellersByProduct.get(l.productId) ?? new Set<string>();
      sellers.add(l.sellerName);
      sellersByProduct.set(l.productId, sellers);
    }
    const multiSeller = [...sellersByProduct.values()].filter(
      (s) => s.size > 1,
    );

    expect(multiSeller).toHaveLength(54);
  });
});
