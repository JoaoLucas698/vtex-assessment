import { Injectable } from '@nestjs/common';
import type {
  SellerProductOutput,
  SellerProductWithProduct,
} from '@modules/sellers/schemas/seller.types';
import { fillFromOfficialProduct } from '@shared/catalog/fill-from-official-product';

/**
 * Monta a visão do vínculo para a API. O fallback de `brand`/`category` para o
 * produto oficial (D-014) vem da regra compartilhada (D-061). Serviço puro.
 */
@Injectable()
export class SellerProductViewService {
  toOutput(link: SellerProductWithProduct): SellerProductOutput {
    const { brand, category } = fillFromOfficialProduct(link, link.product);
    return {
      id: link.id,
      externalId: link.externalId,
      name: link.name,
      brand,
      category,
      matchedBy: link.matchedBy,
      product: { id: link.product.id, name: link.product.name },
    };
  }
}
