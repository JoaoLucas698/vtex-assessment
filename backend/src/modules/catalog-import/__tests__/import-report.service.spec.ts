import {
  ImportItemOutcome,
  MatchedBy,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { ImportReportService } from '@modules/catalog-import/services/import-report.service';

describe('ImportReportService', () => {
  let sut: ImportReportService;

  beforeEach(() => {
    sut = new ImportReportService();
  });

  it('junta inválidos e processados na ordem do arquivo e conta cada resultado', () => {
    const valid = (index: number) => ({
      index,
      externalId: `e-${index}`,
      sellerName: 'Loja',
      name: `Produto ${index}`,
      brand: null,
      category: null,
    });
    const processed = [
      sut.processedItem(valid(0), {
        outcome: ImportItemOutcome.CREATED,
        productId: 1,
        matchedBy: MatchedBy.NEW,
        reason: null,
      }),
      sut.processedItem(valid(2), {
        outcome: ImportItemOutcome.LINKED_EXISTING,
        productId: 1,
        matchedBy: MatchedBy.NORMALIZED_KEY,
        reason: null,
      }),
      sut.processedItem(valid(3), {
        outcome: ImportItemOutcome.ALREADY_LINKED,
        productId: 1,
        matchedBy: MatchedBy.LEGACY,
        reason: null,
      }),
      sut.processedItem(valid(4), {
        outcome: ImportItemOutcome.DUPLICATE_SAME_SELLER,
        productId: 1,
        matchedBy: null,
        reason: 'duplicado',
      }),
    ];
    const invalid = [
      {
        index: 1,
        externalId: null,
        sellerName: 'Loja',
        name: 'Sem Id',
        reason: 'Id ausente.',
      },
    ];

    const report = sut.build(5, invalid, processed);

    expect(report.totals).toEqual({
      read: 5,
      invalid: 1,
      created: 1,
      linkedExisting: 1,
      alreadyLinked: 1,
      duplicateSameSeller: 1,
    });
    expect(report.items.map((item) => item.index)).toEqual([0, 1, 2, 3, 4]);
    expect(report.items[1]).toEqual({
      index: 1,
      externalId: null,
      sellerName: 'Loja',
      name: 'Sem Id',
      outcome: ImportItemOutcome.INVALID,
      productId: null,
      matchedBy: null,
      reason: 'Id ausente.',
    });
  });
});
