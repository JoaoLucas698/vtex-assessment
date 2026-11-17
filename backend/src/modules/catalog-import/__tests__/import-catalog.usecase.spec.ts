import type { Prisma, Seller, SellerProduct } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import {
  CatalogImportErrorCode,
  CatalogImportErrors,
} from '@modules/catalog-import/schemas/catalog-import.errors';
import {
  ImportCatalogInput,
  ImportItemOutcome,
  ImportItemReport,
  ImportReport,
  InvalidCatalogItem,
  MatchDecision,
  MatchDecisionType,
  MatchedBy,
  NormalizationRule,
  ProductKeyFields,
  ValidCatalogItem,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { CatalogFileParserService } from '@modules/catalog-import/services/catalog-file-parser.service';
import { ImportReportService } from '@modules/catalog-import/services/import-report.service';
import { ProductMatchingService } from '@modules/catalog-import/services/product-matching.service';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import { ImportCatalogUseCase } from '@modules/catalog-import/usecases/import-catalog.usecase';
import { NormalizationTypeRepository } from '@modules/normalization-types/repositories/normalization-type.repository';
import {
  NormalizationTypeCode,
  NormalizationTypeRecord,
} from '@modules/normalization-types/schemas/normalization-type.types';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import type { ProductRecord } from '@modules/products/schemas/product.types';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { TransactionManager } from '@shared/prisma/transaction-manager';
import { Result } from '@shared/result/result';

const NOW = new Date('2026-11-14T00:00:00Z');
const FILE_CONTENT = Buffer.from('[...]');
const INPUT: ImportCatalogInput = {
  file: { buffer: FILE_CONTENT, size: FILE_CONTENT.length },
};
const REPORT: ImportReport = {
  totals: {
    read: 0,
    invalid: 0,
    created: 0,
    linkedExisting: 0,
    alreadyLinked: 0,
    duplicateSameSeller: 0,
  },
  items: [],
};

/** Tipos cadastrados pela migration `add_normalization_types` (D-110). */
const TYPES = {
  [NormalizationTypeCode.NAME_BRAND]: {
    id: 1,
    code: NormalizationTypeCode.NAME_BRAND,
    description: 'Nome + marca',
    includesBrand: true,
    includesCategory: false,
  },
  [NormalizationTypeCode.NAME_CATEGORY]: {
    id: 2,
    code: NormalizationTypeCode.NAME_CATEGORY,
    description: 'Nome + categoria',
    includesBrand: false,
    includesCategory: true,
  },
  [NormalizationTypeCode.NAME_BRAND_CATEGORY]: {
    id: 3,
    code: NormalizationTypeCode.NAME_BRAND_CATEGORY,
    description: 'Nome + marca + categoria',
    includesBrand: true,
    includesCategory: true,
  },
} satisfies Record<NormalizationTypeCode, NormalizationTypeRecord>;
const NAME_BRAND = TYPES[NormalizationTypeCode.NAME_BRAND];
const NAME_CATEGORY = TYPES[NormalizationTypeCode.NAME_CATEGORY];
const NAME_BRAND_CATEGORY = TYPES[NormalizationTypeCode.NAME_BRAND_CATEGORY];

/**
 * Chave fake usada pelo mock do normalizer: diferente para cada regra, para os
 * testes enxergarem qual chave foi usada em cada busca.
 */
function fakeKey(fields: ProductKeyFields, rule: NormalizationRule): string {
  return [
    rule.includesBrand ? `b=${fields.brand ?? ''}` : null,
    rule.includesCategory ? `c=${fields.category ?? ''}` : null,
    `n=${fields.name}`,
  ]
    .filter((part) => part !== null)
    .join(';');
}

const CREATE: MatchDecision = {
  type: MatchDecisionType.CREATE_PRODUCT,
  matchedBy: MatchedBy.NEW,
};

function item(overrides: Partial<ValidCatalogItem> = {}): ValidCatalogItem {
  return {
    index: 0,
    externalId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    sellerName: 'MegaStore',
    name: 'Smartphone Galaxy S23',
    brand: 'Samsung',
    category: 'Electronics',
    ...overrides,
  };
}

function invalid(
  overrides: Partial<InvalidCatalogItem> = {},
): InvalidCatalogItem {
  return {
    index: 1,
    externalId: null,
    sellerName: 'MegaStore',
    name: 'Sem Id',
    reason: 'Id ausente.',
    ...overrides,
  };
}

function seller(id: number, sellerName: string): Seller {
  return { id, sellerName, createdAt: NOW, updatedAt: NOW };
}

function product(
  id: number,
  normalizationTypeId = NAME_BRAND.id,
): ProductRecord {
  return {
    id,
    name: 'Produto',
    brand: null,
    category: null,
    normalizationTypeId,
    normalizedKey: 'k',
  };
}

function link(overrides: Partial<SellerProduct> = {}): SellerProduct {
  return {
    id: 100,
    productId: 10,
    sellerId: 1,
    externalId: 'ext-1',
    name: 'Produto',
    brand: null,
    category: null,
    matchedBy: MatchedBy.NEW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('ImportCatalogUseCase', () => {
  let sut: ImportCatalogUseCase;
  let transactionManager: DeepMockProxy<TransactionManager>;
  let parser: DeepMockProxy<CatalogFileParserService>;
  let normalizer: DeepMockProxy<ProductNormalizerService>;
  let matching: DeepMockProxy<ProductMatchingService>;
  let report: DeepMockProxy<ImportReportService>;
  let sellerRepository: DeepMockProxy<SellerRepository>;
  let sellerProductRepository: DeepMockProxy<SellerProductRepository>;
  let productRepository: DeepMockProxy<ProductRepository>;
  let normalizationTypeRepository: DeepMockProxy<NormalizationTypeRepository>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;

  /** Configura o parser para devolver estes itens. */
  function givenFile(
    valid: ValidCatalogItem[],
    invalidItems: InvalidCatalogItem[] = [],
  ): void {
    parser.parse.mockReturnValue(
      Result.success({
        total: valid.length + invalidItems.length,
        valid,
        invalid: invalidItems,
      }),
    );
  }

  /** Detalhes passados ao `ImportReportService` para a n-ésima linha processada. */
  function reportedDetails(
    call: number,
  ): Parameters<ImportReportService['processedItem']>[1] {
    return report.processedItem.mock.calls[call][1];
  }

  beforeEach(() => {
    transactionManager = mockDeep<TransactionManager>();
    parser = mockDeep<CatalogFileParserService>();
    normalizer = mockDeep<ProductNormalizerService>();
    matching = mockDeep<ProductMatchingService>();
    report = mockDeep<ImportReportService>();
    sellerRepository = mockDeep<SellerRepository>();
    sellerProductRepository = mockDeep<SellerProductRepository>();
    productRepository = mockDeep<ProductRepository>();
    normalizationTypeRepository = mockDeep<NormalizationTypeRepository>();
    tx = mockDeep<Prisma.TransactionClient>();

    transactionManager.run.mockImplementation((work) => work(tx));
    normalizationTypeRepository.findByCode.mockImplementation((code) =>
      Promise.resolve(
        Object.values<NormalizationTypeRecord>(TYPES).find(
          (type) => type.code === code,
        ) ?? null,
      ),
    );
    normalizationTypeRepository.findAll.mockResolvedValue(Object.values(TYPES));
    report.build.mockReturnValue(REPORT);
    report.processedItem.mockImplementation(
      (processed, details): ImportItemReport => ({
        index: processed.index,
        externalId: processed.externalId,
        sellerName: processed.sellerName,
        name: processed.name,
        ...details,
      }),
    );

    sut = new ImportCatalogUseCase(
      transactionManager,
      parser,
      normalizer,
      matching,
      report,
      sellerRepository,
      sellerProductRepository,
      productRepository,
      normalizationTypeRepository,
    );
  });

  describe('arquivo', () => {
    it('retorna FILE_REQUIRED sem arquivo, sem chamar o parser nem abrir transação', async () => {
      const result = await sut.execute({ file: undefined });

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe(CatalogImportErrorCode.FILE_REQUIRED);
      }
      expect(parser.parse).not.toHaveBeenCalled();
      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it.each([
      ['JSON inválido', CatalogImportErrors.invalidJson('Unexpected end')],
      ['JSON que não é array', CatalogImportErrors.notAnArray()],
      ['array vazio', CatalogImportErrors.emptyFile()],
    ])(
      'devolve o erro do parser para %s sem abrir transação',
      async (_, error) => {
        parser.parse.mockReturnValue(Result.error(error));

        const result = await sut.execute(INPUT);

        expect(result.isFailure).toBe(true);
        if (result.isFailure) expect(result.error).toEqual(error);
        expect(parser.parse).toHaveBeenCalledWith(FILE_CONTENT);
        expect(transactionManager.run).not.toHaveBeenCalled();
        expect(report.build).not.toHaveBeenCalled();
      },
    );
  });

  describe('itens', () => {
    beforeEach(() => {
      sellerRepository.findByName.mockResolvedValue(null);
      sellerRepository.create.mockResolvedValue(seller(1, 'MegaStore'));
      sellerProductRepository.findBySellerAndExternalId.mockResolvedValue(null);
      sellerProductRepository.findBySellerAndProduct.mockResolvedValue(null);
      productRepository.findByTypeAndKey.mockResolvedValue(null);
      productRepository.create.mockResolvedValue(product(10));
      sellerProductRepository.create.mockResolvedValue(link());
      normalizer.buildKey.mockReturnValue('samsung|smartphone galaxy s23');
    });

    it('cria produto novo (new) com os dados do seller e o vínculo, tudo no mesmo tx', async () => {
      givenFile([item()]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value).toEqual({
          normalizationType: NormalizationTypeCode.NAME_BRAND,
          ...REPORT,
        });
      }
      expect(transactionManager.run).toHaveBeenCalledTimes(1);
      expect(normalizer.buildKey).toHaveBeenCalledWith(item(), NAME_BRAND);
      expect(matching.decide).toHaveBeenCalledWith({
        linkByExternalId: null,
        productByKey: null,
        sellerLinkToProduct: null,
      });
      expect(productRepository.create).toHaveBeenCalledWith(
        {
          name: 'Smartphone Galaxy S23',
          brand: 'Samsung',
          category: 'Electronics',
          normalizationTypeId: NAME_BRAND.id,
          normalizedKey: 'samsung|smartphone galaxy s23',
        },
        tx,
      );
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        {
          productId: 10,
          sellerId: 1,
          externalId: item().externalId,
          name: 'Smartphone Galaxy S23',
          brand: 'Samsung',
          category: 'Electronics',
          matchedBy: MatchedBy.NEW,
        },
        tx,
      );
      expect(matching.toOutcome).toHaveBeenCalledWith(CREATE);
      expect(reportedDetails(0)).toEqual({
        outcome: ImportItemOutcome.CREATED,
        productId: 10,
        matchedBy: MatchedBy.NEW,
        reason: null,
      });
      expect(report.build).toHaveBeenCalledWith(
        1,
        [],
        [expect.objectContaining({ index: 0, productId: 10 })],
      );
    });

    it('liga a produto existente pela chave normalizada (normalized_key) sem criar produto', async () => {
      givenFile([item({ name: 'Smartphone  Galaxy S23' })]);
      productRepository.findByTypeAndKey.mockResolvedValue(product(7));
      matching.decide.mockReturnValue({
        type: MatchDecisionType.LINK_EXISTING,
        productId: 7,
        matchedBy: MatchedBy.NORMALIZED_KEY,
      });
      matching.toOutcome.mockReturnValue(ImportItemOutcome.LINKED_EXISTING);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(productRepository.findByTypeAndKey).toHaveBeenCalledWith(
        NAME_BRAND.id,
        'samsung|smartphone galaxy s23',
        tx,
      );
      expect(
        sellerProductRepository.findBySellerAndProduct,
      ).toHaveBeenCalledWith(1, 7, tx);
      expect(matching.decide).toHaveBeenCalledWith({
        linkByExternalId: null,
        productByKey: product(7),
        sellerLinkToProduct: null,
      });
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 7,
          name: 'Smartphone  Galaxy S23',
          matchedBy: MatchedBy.NORMALIZED_KEY,
        }),
        tx,
      );
      expect(reportedDetails(0)).toEqual({
        outcome: ImportItemOutcome.LINKED_EXISTING,
        productId: 7,
        matchedBy: MatchedBy.NORMALIZED_KEY,
        reason: null,
      });
    });

    it('reenvio do mesmo externalId pelo mesmo seller atualiza os dados do seller sem buscar a chave', async () => {
      const existing = link({ id: 55, productId: 9, sellerId: 3 });
      givenFile([item()]);
      sellerRepository.findByName.mockResolvedValue(seller(3, 'MegaStore'));
      sellerProductRepository.findBySellerAndExternalId.mockResolvedValue(
        existing,
      );
      sellerProductRepository.updateSellerData.mockResolvedValue(
        link({ id: 55, productId: 9, matchedBy: MatchedBy.LEGACY }),
      );
      matching.decide.mockReturnValue({
        type: MatchDecisionType.ALREADY_LINKED,
        sellerProductId: 55,
        productId: 9,
      });
      matching.toOutcome.mockReturnValue(ImportItemOutcome.ALREADY_LINKED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(
        sellerProductRepository.findBySellerAndExternalId,
      ).toHaveBeenCalledWith(3, item().externalId, tx);
      expect(matching.decide).toHaveBeenCalledWith({
        linkByExternalId: existing,
        productByKey: null,
        sellerLinkToProduct: null,
      });
      expect(sellerProductRepository.updateSellerData).toHaveBeenCalledWith(
        55,
        {
          name: 'Smartphone Galaxy S23',
          brand: 'Samsung',
          category: 'Electronics',
        },
        tx,
      );
      expect(reportedDetails(0)).toEqual({
        outcome: ImportItemOutcome.ALREADY_LINKED,
        productId: 9,
        matchedBy: MatchedBy.LEGACY,
        reason: null,
      });
      expect(productRepository.findByTypeAndKey).not.toHaveBeenCalled();
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).not.toHaveBeenCalled();
      expect(sellerRepository.create).not.toHaveBeenCalled();
    });

    it('mesmo Id em sellers diferentes com produtos diferentes cria dois vínculos, sem conflito', async () => {
      const sharedId = '00112233-4455-4667-7889-900112233445';
      givenFile([
        item({
          index: 0,
          externalId: sharedId,
          sellerName: 'GardenStore',
          name: 'Curtain Rod',
        }),
        item({
          index: 1,
          externalId: sharedId,
          sellerName: 'SportsHub',
          name: 'Bookshelf',
        }),
      ]);
      sellerRepository.create
        .mockResolvedValueOnce(seller(1, 'GardenStore'))
        .mockResolvedValueOnce(seller(2, 'SportsHub'));
      productRepository.create
        .mockResolvedValueOnce(product(10))
        .mockResolvedValueOnce(product(11));
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(
        sellerProductRepository.findBySellerAndExternalId,
      ).toHaveBeenNthCalledWith(1, 1, sharedId, tx);
      expect(
        sellerProductRepository.findBySellerAndExternalId,
      ).toHaveBeenNthCalledWith(2, 2, sharedId, tx);
      expect(sellerProductRepository.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          sellerId: 1,
          productId: 10,
          externalId: sharedId,
        }),
        tx,
      );
      expect(sellerProductRepository.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sellerId: 2,
          productId: 11,
          externalId: sharedId,
        }),
        tx,
      );
    });

    it('mesmo produto enviado de novo pelo mesmo seller com outro Id: nada é gravado e vale o primeiro', async () => {
      const kept = link({ id: 100, productId: 10, externalId: 'id-1' });
      givenFile([item({ externalId: 'id-2' })]);
      productRepository.findByTypeAndKey.mockResolvedValue(product(10));
      sellerProductRepository.findBySellerAndProduct.mockResolvedValue(kept);
      matching.decide.mockReturnValue({
        type: MatchDecisionType.DUPLICATE_SAME_SELLER,
        productId: 10,
        existingSellerProductId: 100,
        existingExternalId: 'id-1',
      });
      matching.toOutcome.mockReturnValue(
        ImportItemOutcome.DUPLICATE_SAME_SELLER,
      );

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(matching.decide).toHaveBeenCalledWith({
        linkByExternalId: null,
        productByKey: product(10),
        sellerLinkToProduct: kept,
      });
      expect(reportedDetails(0)).toMatchObject({
        outcome: ImportItemOutcome.DUPLICATE_SAME_SELLER,
        productId: 10,
        matchedBy: null,
      });
      expect(reportedDetails(0).reason).toContain('"id-1"');
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.updateSellerData).not.toHaveBeenCalled();
    });

    it('duplicado contra vínculo legado sem externalId explica no motivo', async () => {
      givenFile([item()]);
      productRepository.findByTypeAndKey.mockResolvedValue(product(10));
      sellerProductRepository.findBySellerAndProduct.mockResolvedValue(
        link({ externalId: null, matchedBy: MatchedBy.LEGACY }),
      );
      matching.decide.mockReturnValue({
        type: MatchDecisionType.DUPLICATE_SAME_SELLER,
        productId: 10,
        existingSellerProductId: 100,
        existingExternalId: null,
      });
      matching.toOutcome.mockReturnValue(
        ImportItemOutcome.DUPLICATE_SAME_SELLER,
      );

      await sut.execute(INPUT);

      expect(reportedDetails(0).reason).toContain('sem externalId');
    });

    it('processa os itens em ordem: o seguinte enxerga o produto gravado pelo anterior (dedupe no arquivo)', async () => {
      givenFile([
        item({ index: 0 }),
        item({ index: 1, externalId: 'outro-id', sellerName: 'FitnessCenter' }),
      ]);
      sellerRepository.create
        .mockResolvedValueOnce(seller(1, 'MegaStore'))
        .mockResolvedValueOnce(seller(2, 'FitnessCenter'));
      // Item 0: nenhum produto nos três tipos. Item 1: acha o criado pelo item 0.
      productRepository.findByTypeAndKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(product(10));
      matching.decide.mockReturnValueOnce(CREATE).mockReturnValueOnce({
        type: MatchDecisionType.LINK_EXISTING,
        productId: 10,
        matchedBy: MatchedBy.NORMALIZED_KEY,
      });
      matching.toOutcome
        .mockReturnValueOnce(ImportItemOutcome.CREATED)
        .mockReturnValueOnce(ImportItemOutcome.LINKED_EXISTING);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(matching.decide).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ productByKey: product(10) }),
      );
      expect(productRepository.create).toHaveBeenCalledTimes(1);
      expect(productRepository.create.mock.invocationCallOrder[0]).toBeLessThan(
        productRepository.findByTypeAndKey.mock.invocationCallOrder[3],
      );
      expect(report.build).toHaveBeenCalledWith(
        2,
        [],
        [
          expect.objectContaining({
            index: 0,
            outcome: ImportItemOutcome.CREATED,
          }),
          expect.objectContaining({
            index: 1,
            outcome: ImportItemOutcome.LINKED_EXISTING,
          }),
        ],
      );
    });

    it('aceita Id fora do formato UUID e o usa como veio', async () => {
      givenFile([item({ externalId: 'ddddeee-ffff-0000' })]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(
        sellerProductRepository.findBySellerAndExternalId,
      ).toHaveBeenCalledWith(1, 'ddddeee-ffff-0000', tx);
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ externalId: 'ddddeee-ffff-0000' }),
        tx,
      );
    });

    it('itens inválidos (sem Id, SellerName ou Name) vão só para o relatório, com o motivo', async () => {
      const rejected = [
        invalid({ index: 0, reason: 'Id ausente.' }),
        invalid({
          index: 1,
          externalId: 'x-2',
          sellerName: '  ',
          reason: 'SellerName vazio.',
        }),
        invalid({
          index: 2,
          externalId: 'x-3',
          name: null,
          reason: 'Name ausente.',
        }),
      ];
      givenFile([item({ index: 3 })], rejected);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(sellerRepository.findByName).toHaveBeenCalledTimes(1);
      expect(matching.decide).toHaveBeenCalledTimes(1);
      expect(productRepository.create).toHaveBeenCalledTimes(1);
      expect(report.build).toHaveBeenCalledWith(4, rejected, [
        expect.objectContaining({ index: 3 }),
      ]);
    });

    it('arquivo só com itens inválidos não grava nada', async () => {
      const rejected = [invalid({ index: 0 })];
      givenFile([], rejected);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(sellerRepository.findByName).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).not.toHaveBeenCalled();
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(report.build).toHaveBeenCalledWith(1, rejected, []);
    });

    it('aceita Brand null e Category null, gravando null', async () => {
      givenFile([
        item({ name: 'Cable Organizer Kit', brand: null, category: null }),
      ]);
      normalizer.buildKey.mockReturnValue('|cable organizer kit');
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(normalizer.buildKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cable Organizer Kit',
          brand: null,
          category: null,
        }),
        NAME_BRAND,
      );
      expect(productRepository.create).toHaveBeenCalledWith(
        {
          name: 'Cable Organizer Kit',
          brand: null,
          category: null,
          normalizationTypeId: NAME_BRAND.id,
          normalizedKey: '|cable organizer kit',
        },
        tx,
      );
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ brand: null, category: null }),
        tx,
      );
    });

    it('grava o item com tentativa de SQL injection com o brand exato', async () => {
      const malicious = "TestBrand'; SELECT 1; --";
      givenFile([item({ brand: malicious })]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(normalizer.buildKey).toHaveBeenCalledWith(
        expect.objectContaining({ brand: malicious }),
        NAME_BRAND,
      );
      expect(productRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ brand: malicious }),
        tx,
      );
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ brand: malicious }),
        tx,
      );
    });

    it("grava Levi's e textos com espaços exatamente como vieram", async () => {
      givenFile([
        item({
          externalId: ' l-1 ',
          sellerName: 'FashionHub',
          name: ' Jeans 501  Original ',
          brand: "Levi's",
          category: null,
        }),
      ]);
      sellerRepository.create.mockResolvedValue(seller(1, 'FashionHub'));
      normalizer.buildKey.mockReturnValue('levis|jeans 501 original');
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(sellerRepository.findByName).toHaveBeenCalledWith(
        'FashionHub',
        tx,
      );
      expect(
        sellerProductRepository.findBySellerAndExternalId,
      ).toHaveBeenCalledWith(1, ' l-1 ', tx);
      expect(productRepository.create).toHaveBeenCalledWith(
        {
          name: ' Jeans 501  Original ',
          brand: "Levi's",
          category: null,
          normalizationTypeId: NAME_BRAND.id,
          normalizedKey: 'levis|jeans 501 original',
        },
        tx,
      );
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: ' l-1 ',
          name: ' Jeans 501  Original ',
          brand: "Levi's",
        }),
        tx,
      );
    });

    it('cria o seller automaticamente na primeira aparição e reaproveita nos itens seguintes', async () => {
      givenFile([
        item({ index: 0 }),
        item({ index: 1, externalId: 'b-2', name: 'Notebook Dell XPS 13' }),
      ]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(sellerRepository.findByName).toHaveBeenCalledTimes(1);
      expect(sellerRepository.findByName).toHaveBeenCalledWith('MegaStore', tx);
      expect(sellerRepository.create).toHaveBeenCalledTimes(1);
      expect(sellerRepository.create).toHaveBeenCalledWith('MegaStore', tx);
      expect(sellerProductRepository.create).toHaveBeenCalledTimes(2);
    });

    it('usa o seller existente sem criar outro', async () => {
      givenFile([item()]);
      sellerRepository.findByName.mockResolvedValue(seller(8, 'MegaStore'));
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      expect(sellerRepository.create).not.toHaveBeenCalled();
      expect(
        sellerProductRepository.findBySellerAndExternalId,
      ).toHaveBeenCalledWith(8, item().externalId, tx);
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sellerId: 8 }),
        tx,
      );
    });
  });
  describe('tipo de normalização', () => {
    beforeEach(() => {
      sellerRepository.findByName.mockResolvedValue(seller(1, 'MegaStore'));
      sellerProductRepository.findBySellerAndExternalId.mockResolvedValue(null);
      sellerProductRepository.findBySellerAndProduct.mockResolvedValue(null);
      productRepository.findByTypeAndKey.mockResolvedValue(null);
      productRepository.create.mockResolvedValue(product(10));
      sellerProductRepository.create.mockResolvedValue(link());
      normalizer.buildKey.mockImplementation(fakeKey);
    });

    /** Produto devolvido pela busca só para este tipo; os outros não acham nada. */
    function givenProductInType(found: Partial<Record<number, number>>): void {
      productRepository.findByTypeAndKey.mockImplementation((typeId) => {
        const productId = found[typeId];
        return Promise.resolve(
          productId === undefined ? null : product(productId, typeId),
        );
      });
    }

    it('usa NAME_BRAND quando o campo não vem e devolve o código usado', async () => {
      givenFile([item()]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute(INPUT);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.normalizationType).toBe(
          NormalizationTypeCode.NAME_BRAND,
        );
      }
      expect(normalizationTypeRepository.findByCode).toHaveBeenCalledWith(
        NormalizationTypeCode.NAME_BRAND,
      );
      expect(productRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          normalizationTypeId: NAME_BRAND.id,
          normalizedKey: fakeKey(item(), NAME_BRAND),
        }),
        tx,
      );
    });

    it('trata normalizationType null como ausente (NAME_BRAND)', async () => {
      givenFile([item()]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute({ ...INPUT, normalizationType: null });

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.normalizationType).toBe(
          NormalizationTypeCode.NAME_BRAND,
        );
      }
    });

    it.each([
      ['código desconhecido', 'NAME_COLOR'],
      ['texto vazio', ''],
      ['caixa diferente', 'name_brand'],
      ['tentativa de SQL injection', "x'; SELECT 1; --"],
    ])(
      'retorna INVALID_NORMALIZATION_TYPE para %s sem consultar o banco, sem parse e sem transação',
      async (_label, code) => {
        const result = await sut.execute({ ...INPUT, normalizationType: code });

        expect(result.isFailure).toBe(true);
        if (result.isFailure) {
          expect(result.error.code).toBe(
            CatalogImportErrorCode.INVALID_NORMALIZATION_TYPE,
          );
          expect(result.error.message).toContain(code);
        }
        expect(normalizationTypeRepository.findByCode).not.toHaveBeenCalled();
        expect(parser.parse).not.toHaveBeenCalled();
        expect(transactionManager.run).not.toHaveBeenCalled();
      },
    );

    it('retorna INVALID_NORMALIZATION_TYPE quando o código do enum não está cadastrado no banco', async () => {
      normalizationTypeRepository.findByCode.mockResolvedValue(null);

      const result = await sut.execute({
        ...INPUT,
        normalizationType: NormalizationTypeCode.NAME_CATEGORY,
      });

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe(
          CatalogImportErrorCode.INVALID_NORMALIZATION_TYPE,
        );
      }
      expect(parser.parse).not.toHaveBeenCalled();
      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it('valida o arquivo antes do tipo: sem arquivo é FILE_REQUIRED mesmo com tipo inválido', async () => {
      const result = await sut.execute({
        file: undefined,
        normalizationType: 'NAME_COLOR',
      });

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe(CatalogImportErrorCode.FILE_REQUIRED);
      }
    });

    it('cria o produto com o id e a chave do tipo escolhido', async () => {
      givenFile([item()]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute({
        ...INPUT,
        normalizationType: NormalizationTypeCode.NAME_CATEGORY,
      });

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.normalizationType).toBe(
          NormalizationTypeCode.NAME_CATEGORY,
        );
      }
      expect(productRepository.create).toHaveBeenCalledWith(
        {
          name: 'Smartphone Galaxy S23',
          brand: 'Samsung',
          category: 'Electronics',
          normalizationTypeId: NAME_CATEGORY.id,
          normalizedKey: fakeKey(item(), NAME_CATEGORY),
        },
        tx,
      );
    });

    it('busca o produto pela regra de cada tipo: o escolhido primeiro e depois os demais por id', async () => {
      givenFile([item()]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      await sut.execute({
        ...INPUT,
        normalizationType: NormalizationTypeCode.NAME_BRAND_CATEGORY,
      });

      expect(
        productRepository.findByTypeAndKey.mock.calls.map(([typeId, key]) => [
          typeId,
          key,
        ]),
      ).toEqual([
        [NAME_BRAND_CATEGORY.id, fakeKey(item(), NAME_BRAND_CATEGORY)],
        [NAME_BRAND.id, fakeKey(item(), NAME_BRAND)],
        [NAME_CATEGORY.id, fakeKey(item(), NAME_CATEGORY)],
      ]);
      expect(productRepository.findByTypeAndKey).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        tx,
      );
    });

    it('liga a um produto de outro tipo quando o item bate pela regra daquele produto', async () => {
      givenFile([item()]);
      givenProductInType({ [NAME_BRAND.id]: 7 });
      matching.decide.mockReturnValue({
        type: MatchDecisionType.LINK_EXISTING,
        productId: 7,
        matchedBy: MatchedBy.NORMALIZED_KEY,
      });
      matching.toOutcome.mockReturnValue(ImportItemOutcome.LINKED_EXISTING);

      const result = await sut.execute({
        ...INPUT,
        normalizationType: NormalizationTypeCode.NAME_CATEGORY,
      });

      expect(result.isSuccess).toBe(true);
      expect(productRepository.findByTypeAndKey).toHaveBeenNthCalledWith(
        1,
        NAME_CATEGORY.id,
        fakeKey(item(), NAME_CATEGORY),
        tx,
      );
      expect(productRepository.findByTypeAndKey).toHaveBeenNthCalledWith(
        2,
        NAME_BRAND.id,
        fakeKey(item(), NAME_BRAND),
        tx,
      );
      expect(productRepository.findByTypeAndKey).toHaveBeenCalledTimes(2);
      expect(matching.decide).toHaveBeenCalledWith({
        linkByExternalId: null,
        productByKey: product(7, NAME_BRAND.id),
        sellerLinkToProduct: null,
      });
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 7,
          matchedBy: MatchedBy.NORMALIZED_KEY,
        }),
        tx,
      );
    });

    it('com produtos em mais de um tipo, vence o do tipo escolhido', async () => {
      givenFile([item()]);
      givenProductInType({ [NAME_BRAND.id]: 7, [NAME_CATEGORY.id]: 8 });
      matching.decide.mockReturnValue({
        type: MatchDecisionType.LINK_EXISTING,
        productId: 8,
        matchedBy: MatchedBy.NORMALIZED_KEY,
      });
      matching.toOutcome.mockReturnValue(ImportItemOutcome.LINKED_EXISTING);

      await sut.execute({
        ...INPUT,
        normalizationType: NormalizationTypeCode.NAME_CATEGORY,
      });

      expect(productRepository.findByTypeAndKey).toHaveBeenCalledTimes(1);
      expect(matching.decide).toHaveBeenCalledWith(
        expect.objectContaining({
          productByKey: product(8, NAME_CATEGORY.id),
        }),
      );
    });

    it('com NAME_BRAND (padrão), um produto NAME_BRAND vence um NAME_CATEGORY', async () => {
      givenFile([item()]);
      givenProductInType({ [NAME_BRAND.id]: 7, [NAME_CATEGORY.id]: 8 });
      matching.decide.mockReturnValue({
        type: MatchDecisionType.LINK_EXISTING,
        productId: 7,
        matchedBy: MatchedBy.NORMALIZED_KEY,
      });
      matching.toOutcome.mockReturnValue(ImportItemOutcome.LINKED_EXISTING);

      await sut.execute(INPUT);

      expect(matching.decide).toHaveBeenCalledWith(
        expect.objectContaining({ productByKey: product(7, NAME_BRAND.id) }),
      );
    });

    it('carrega os tipos uma vez por importação, dentro da transação', async () => {
      givenFile([
        item({ index: 0 }),
        item({ index: 1, externalId: 'b-2', name: 'Notebook Dell XPS 13' }),
      ]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      await sut.execute({
        ...INPUT,
        normalizationType: NormalizationTypeCode.NAME_CATEGORY,
      });

      expect(normalizationTypeRepository.findAll).toHaveBeenCalledTimes(1);
      expect(normalizationTypeRepository.findAll).toHaveBeenCalledWith(tx);
      expect(normalizationTypeRepository.findByCode).toHaveBeenCalledTimes(1);
    });

    it('reimportar com o mesmo tipo é idempotente: o vínculo pelo externalId já existe e nada é criado', async () => {
      const existing = link({ id: 55, productId: 10 });
      givenFile([item()]);
      sellerProductRepository.findBySellerAndExternalId.mockResolvedValue(
        existing,
      );
      sellerProductRepository.updateSellerData.mockResolvedValue(existing);
      matching.decide.mockReturnValue({
        type: MatchDecisionType.ALREADY_LINKED,
        sellerProductId: 55,
        productId: 10,
      });
      matching.toOutcome.mockReturnValue(ImportItemOutcome.ALREADY_LINKED);

      const result = await sut.execute({
        ...INPUT,
        normalizationType: NormalizationTypeCode.NAME_CATEGORY,
      });

      expect(result.isSuccess).toBe(true);
      expect(productRepository.findByTypeAndKey).not.toHaveBeenCalled();
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).not.toHaveBeenCalled();
      expect(reportedDetails(0)).toMatchObject({
        outcome: ImportItemOutcome.ALREADY_LINKED,
        productId: 10,
      });
    });

    it('grava a categoria com tentativa de SQL injection com o texto exato', async () => {
      const malicious = "x'; SELECT 1; --";
      givenFile([item({ category: malicious })]);
      matching.decide.mockReturnValue(CREATE);
      matching.toOutcome.mockReturnValue(ImportItemOutcome.CREATED);

      const result = await sut.execute({
        ...INPUT,
        normalizationType: NormalizationTypeCode.NAME_CATEGORY,
      });

      expect(result.isSuccess).toBe(true);
      expect(normalizer.buildKey).toHaveBeenCalledWith(
        expect.objectContaining({ category: malicious }),
        NAME_CATEGORY,
      );
      expect(productRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: malicious,
          normalizationTypeId: NAME_CATEGORY.id,
        }),
        tx,
      );
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ category: malicious }),
        tx,
      );
    });
  });
});
