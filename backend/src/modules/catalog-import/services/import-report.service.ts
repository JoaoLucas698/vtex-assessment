import { Injectable } from '@nestjs/common';
import {
  ImportCatalogOutput,
  ImportItemOutcome,
  ImportItemReport,
  ImportTotals,
  InvalidCatalogItem,
  ValidCatalogItem,
} from '@modules/catalog-import/schemas/catalog-import.types';

/** Campos da linha do relatório que dependem da decisão tomada para o item. */
export type ImportItemDetails = Pick<
  ImportItemReport,
  'outcome' | 'productId' | 'matchedBy' | 'reason'
>;

/**
 * Monta o relatório da importação (`docs/context.md` §5).
 * Service puro: recebe dados e devolve dados, sem banco e sem falha esperada.
 */
@Injectable()
export class ImportReportService {
  /** Linha de um item válido, já processado. */
  processedItem(
    item: ValidCatalogItem,
    details: ImportItemDetails,
  ): ImportItemReport {
    return {
      index: item.index,
      externalId: item.externalId,
      sellerName: item.sellerName,
      name: item.name,
      ...details,
    };
  }

  /** Linha de um item rejeitado na validação (D-011). */
  invalidItem(item: InvalidCatalogItem): ImportItemReport {
    return {
      index: item.index,
      externalId: item.externalId,
      sellerName: item.sellerName,
      name: item.name,
      outcome: ImportItemOutcome.INVALID,
      productId: null,
      matchedBy: null,
      reason: item.reason,
    };
  }

  /**
   * Junta inválidos e processados na ordem do arquivo (`index`) e calcula os totais.
   * `read` é a quantidade de itens do array, válidos ou não.
   */
  build(
    read: number,
    invalid: InvalidCatalogItem[],
    processed: ImportItemReport[],
  ): ImportCatalogOutput {
    const items = [
      ...invalid.map((item) => this.invalidItem(item)),
      ...processed,
    ].sort((a, b) => a.index - b.index);
    return { totals: this.countTotals(read, items), items };
  }

  private countTotals(read: number, items: ImportItemReport[]): ImportTotals {
    const count = (outcome: ImportItemOutcome): number =>
      items.filter((item) => item.outcome === outcome).length;
    return {
      read,
      invalid: count(ImportItemOutcome.INVALID),
      created: count(ImportItemOutcome.CREATED),
      linkedExisting: count(ImportItemOutcome.LINKED_EXISTING),
      alreadyLinked: count(ImportItemOutcome.ALREADY_LINKED),
      duplicateSameSeller: count(ImportItemOutcome.DUPLICATE_SAME_SELLER),
    };
  }
}
