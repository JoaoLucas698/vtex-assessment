import { Injectable } from '@nestjs/common';
import {
  ImportItemOutcome,
  MatchDecision,
  MatchDecisionType,
  MatchedBy,
  MatchInput,
} from '@modules/catalog-import/schemas/catalog-import.types';

/**
 * Materializa a "Ordem de verificação" de `docs/context.md` §4 como uma decisão
 * (D-005, D-012, D-040).
 *
 * Service puro: não recebe repository. O usecase de importação busca os dados
 * (`MatchInput`) dentro da transação, pede a decisão e executa a gravação
 * correspondente. Como não existe falha esperada aqui, a decisão é devolvida
 * direto, sem `Result` (`CLAUDE.md` §3).
 *
 * Ordem aplicada:
 * 0. já existe vínculo com o mesmo `(sellerId, externalId)` → `ALREADY_LINKED`
 *    (não roda o matching; atualiza os dados enviados pelo seller);
 * 1. existe produto com a mesma chave normalizada:
 *    - o seller já está ligado a ele (com outro `externalId`) → `DUPLICATE_SAME_SELLER`
 *      (vale o primeiro vínculo, D-012);
 *    - senão → `LINK_EXISTING` com `matchedBy = normalized_key`;
 * 2. nenhum produto com a chave → `CREATE_PRODUCT` com `matchedBy = new`.
 *
 * A decisão é tomada **por seller**: o mesmo `externalId` em sellers diferentes
 * não conflita, porque `linkByExternalId` é buscado pelo par `(sellerId, externalId)`.
 *
 * Deduplicação dentro do próprio arquivo: o usecase grava item a item na mesma
 * transação, então o produto criado pelo item 3 já é encontrado por
 * `productByKey` quando o item 50 é processado. Este service não guarda estado.
 */
@Injectable()
export class ProductMatchingService {
  decide(input: MatchInput): MatchDecision {
    const { linkByExternalId, productByKey, sellerLinkToProduct } = input;

    if (linkByExternalId) {
      return {
        type: MatchDecisionType.ALREADY_LINKED,
        sellerProductId: linkByExternalId.id,
        productId: linkByExternalId.productId,
      };
    }

    if (!productByKey) {
      return {
        type: MatchDecisionType.CREATE_PRODUCT,
        matchedBy: MatchedBy.NEW,
      };
    }

    if (sellerLinkToProduct) {
      return {
        type: MatchDecisionType.DUPLICATE_SAME_SELLER,
        productId: productByKey.id,
        existingSellerProductId: sellerLinkToProduct.id,
        existingExternalId: sellerLinkToProduct.externalId,
      };
    }

    return {
      type: MatchDecisionType.LINK_EXISTING,
      productId: productByKey.id,
      matchedBy: MatchedBy.NORMALIZED_KEY,
    };
  }

  /** Converte a decisão no resultado do item usado no relatório da importação. */
  toOutcome(decision: MatchDecision): ImportItemOutcome {
    switch (decision.type) {
      case MatchDecisionType.ALREADY_LINKED:
        return ImportItemOutcome.ALREADY_LINKED;
      case MatchDecisionType.LINK_EXISTING:
        return ImportItemOutcome.LINKED_EXISTING;
      case MatchDecisionType.CREATE_PRODUCT:
        return ImportItemOutcome.CREATED;
      case MatchDecisionType.DUPLICATE_SAME_SELLER:
        return ImportItemOutcome.DUPLICATE_SAME_SELLER;
    }
  }
}
