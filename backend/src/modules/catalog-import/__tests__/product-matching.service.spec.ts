import {
  ExistingSellerLink,
  ImportItemOutcome,
  MatchDecision,
  MatchDecisionType,
  MatchedBy,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { ProductMatchingService } from '@modules/catalog-import/services/product-matching.service';

describe('ProductMatchingService', () => {
  let sut: ProductMatchingService;

  beforeEach(() => {
    sut = new ProductMatchingService();
  });

  const link = (
    id: number,
    productId: number,
    externalId: string | null,
  ): ExistingSellerLink => ({
    id,
    productId,
    externalId,
  });

  describe('decide', () => {
    it('cria produto novo quando não há vínculo nem produto com a chave', () => {
      const decision = sut.decide({
        linkByExternalId: null,
        productByKey: null,
        sellerLinkToProduct: null,
      });

      expect(decision).toEqual({
        type: MatchDecisionType.CREATE_PRODUCT,
        matchedBy: MatchedBy.NEW,
      });
    });

    it('liga a produto existente pela chave quando o seller ainda não está ligado a ele', () => {
      const decision = sut.decide({
        linkByExternalId: null,
        productByKey: { id: 10 },
        sellerLinkToProduct: null,
      });

      expect(decision).toEqual({
        type: MatchDecisionType.LINK_EXISTING,
        productId: 10,
        matchedBy: MatchedBy.NORMALIZED_KEY,
      });
    });

    it('reporta já vinculado quando o seller reenvia o mesmo externalId', () => {
      const decision = sut.decide({
        linkByExternalId: link(5, 10, 'abc'),
        productByKey: null,
        sellerLinkToProduct: null,
      });

      expect(decision).toEqual({
        type: MatchDecisionType.ALREADY_LINKED,
        sellerProductId: 5,
        productId: 10,
      });
    });

    it('prioriza ALREADY_LINKED sobre os outros ramos, mesmo com produto e vínculo pela chave', () => {
      const decision = sut.decide({
        linkByExternalId: link(5, 10, 'abc'),
        productByKey: { id: 99 },
        sellerLinkToProduct: link(7, 99, 'outro'),
      });

      expect(decision.type).toBe(MatchDecisionType.ALREADY_LINKED);
      if (decision.type === MatchDecisionType.ALREADY_LINKED) {
        expect(decision.sellerProductId).toBe(5);
        // O produto é o do vínculo existente, não o da chave: o matching não roda.
        expect(decision.productId).toBe(10);
      }
    });

    it('reporta duplicado no mesmo seller quando ele já está ligado ao produto com outro externalId', () => {
      const decision = sut.decide({
        linkByExternalId: null,
        productByKey: { id: 10 },
        sellerLinkToProduct: link(3, 10, 'primeiro-id'),
      });

      expect(decision).toEqual({
        type: MatchDecisionType.DUPLICATE_SAME_SELLER,
        productId: 10,
        existingSellerProductId: 3,
        existingExternalId: 'primeiro-id',
      });
    });

    it('reporta duplicado no mesmo seller quando o vínculo existente é legado sem externalId', () => {
      const decision = sut.decide({
        linkByExternalId: null,
        productByKey: { id: 10 },
        sellerLinkToProduct: link(3, 10, null),
      });

      expect(decision.type).toBe(MatchDecisionType.DUPLICATE_SAME_SELLER);
      if (decision.type === MatchDecisionType.DUPLICATE_SAME_SELLER) {
        expect(decision.existingExternalId).toBeNull();
      }
    });

    it('ignora sellerLinkToProduct quando não há produto com a chave', () => {
      const decision = sut.decide({
        linkByExternalId: null,
        productByKey: null,
        sellerLinkToProduct: link(3, 10, 'x'),
      });

      expect(decision.type).toBe(MatchDecisionType.CREATE_PRODUCT);
    });

    it('mesmo Id em sellers diferentes não conflita: a decisão é por seller', () => {
      // Seller A já tem o Id "00112233-..." ligado ao produto 1 ("Curtain Rod").
      // Seller B envia o mesmo Id para outro produto ("Bookshelf"): a busca por
      // (sellerId de B, externalId) não encontra nada, então segue o matching normal.
      const sellerA = sut.decide({
        linkByExternalId: link(1, 1, '00112233-4455-4667-7889-900112233445'),
        productByKey: { id: 1 },
        sellerLinkToProduct: link(1, 1, '00112233-4455-4667-7889-900112233445'),
      });
      const sellerB = sut.decide({
        linkByExternalId: null,
        productByKey: null,
        sellerLinkToProduct: null,
      });

      expect(sellerA.type).toBe(MatchDecisionType.ALREADY_LINKED);
      expect(sellerB).toEqual({
        type: MatchDecisionType.CREATE_PRODUCT,
        matchedBy: MatchedBy.NEW,
      });
    });
  });

  describe('toOutcome', () => {
    it.each<[MatchDecision, ImportItemOutcome]>([
      [
        { type: MatchDecisionType.CREATE_PRODUCT, matchedBy: MatchedBy.NEW },
        ImportItemOutcome.CREATED,
      ],
      [
        {
          type: MatchDecisionType.LINK_EXISTING,
          productId: 1,
          matchedBy: MatchedBy.NORMALIZED_KEY,
        },
        ImportItemOutcome.LINKED_EXISTING,
      ],
      [
        {
          type: MatchDecisionType.ALREADY_LINKED,
          sellerProductId: 1,
          productId: 1,
        },
        ImportItemOutcome.ALREADY_LINKED,
      ],
      [
        {
          type: MatchDecisionType.DUPLICATE_SAME_SELLER,
          productId: 1,
          existingSellerProductId: 1,
          existingExternalId: 'x',
        },
        ImportItemOutcome.DUPLICATE_SAME_SELLER,
      ],
    ])('converte %o em %s', (decision, outcome) => {
      expect(sut.toOutcome(decision)).toBe(outcome);
    });
  });
});
