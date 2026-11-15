import { Injectable } from '@nestjs/common';
import type {
  SellerProductOutput,
  SellerProductWithProduct,
} from '@modules/sellers/schemas/seller.types';

/**
 * Monta a visão do vínculo para a API (D-014): o banco guarda `null` quando o
 * seller não informou `brand`/`category`, e a resposta usa o dado do produto
 * oficial do catálogo nesses casos. Serviço puro, sem acesso ao banco.
 */
@Injectable()
export class SellerProductViewService {
  toOutput(link: SellerProductWithProduct): SellerProductOutput {
    return {
      id: link.id,
      externalId: link.externalId,
      name: link.name,
      brand: link.brand ?? link.product.brand,
      category: link.category ?? link.product.category,
      matchedBy: link.matchedBy,
      product: { id: link.product.id, name: link.product.name },
    };
  }
}
