import type { Prisma, Seller, SellerProduct } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { CatalogImportErrorCode } from '@modules/catalog-import/schemas/catalog-import.errors';
import {
  ImportCatalogInput,
  ImportItemOutcome,
  MatchedBy,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { CatalogFileParserService } from '@modules/catalog-import/services/catalog-file-parser.service';
import { ImportReportService } from '@modules/catalog-import/services/import-report.service';
import { ProductMatchingService } from '@modules/catalog-import/services/product-matching.service';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import { ImportCatalogUseCase } from '@modules/catalog-import/usecases/import-catalog.usecase';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import type { ProductRecord } from '@modules/products/schemas/product.types';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { TransactionManager } from '@shared/prisma/transaction-manager';

const NOW = new Date('2026-11-14T00:00:00Z');

function upload(content: unknown): ImportCatalogInput {
  const buffer = Buffer.from(
    typeof content === 'string' ? content : JSON.stringify(content),
  );
  return { file: { buffer, size: buffer.length } };
}

function seller(id: number, sellerName: string): Seller {
  return { id, sellerName, createdAt: NOW, updatedAt: NOW };
}

function product(id: number, normalizedKey: string): ProductRecord {
  return { id, name: 'Produto', brand: null, category: null, normalizedKey };
}

function link(overrides: Partial<SellerProduct>): SellerProduct {
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

const MEGASTORE_ITEM = {
  Id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  SellerName: 'MegaStore',
  Name: 'Smartphone Galaxy S23',
  Brand: 'Samsung',
  Category: 'Electronics',
};

describe('ImportCatalogUseCase', () => {
  let sut: ImportCatalogUseCase;
  let transactionManager: DeepMockProxy<TransactionManager>;
  let sellerRepository: DeepMockProxy<SellerRepository>;
  let sellerProductRepository: DeepMockProxy<SellerProductRepository>;
  let productRepository: DeepMockProxy<ProductRepository>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;
  const normalizer = new ProductNormalizerService();

  beforeEach(() => {
    transactionManager = mockDeep<TransactionManager>();
    sellerRepository = mockDeep<SellerRepository>();
    sellerProductRepository = mockDeep<SellerProductRepository>();
    productRepository = mockDeep<ProductRepository>();
    tx = mockDeep<Prisma.TransactionClient>();
    transactionManager.run.mockImplementation((work) => work(tx));

    // Padrão: catálogo vazio. Seller criado com id sequencial, produto e vínculo idem.
    let nextSellerId = 1;
    let nextProductId = 10;
    let nextLinkId = 100;
    sellerRepository.findByName.mockResolvedValue(null);
    sellerRepository.create.mockImplementation((name) =>
      Promise.resolve(seller(nextSellerId++, name)),
    );
    sellerProductRepository.findBySellerAndExternalId.mockResolvedValue(null);
    sellerProductRepository.findBySellerAndProduct.mockResolvedValue(null);
    productRepository.findByNormalizedKey.mockResolvedValue(null);
    productRepository.create.mockImplementation((data) =>
      Promise.resolve({ id: nextProductId++, ...data }),
    );
    sellerProductRepository.create.mockImplementation((data) =>
      Promise.resolve(link({ ...data, id: nextLinkId++ })),
    );

    sut = new ImportCatalogUseCase(
      transactionManager,
      new CatalogFileParserService(),
      normalizer,
      new ProductMatchingService(),
      new ImportReportService(),
      sellerRepository,
      sellerProductRepository,
      productRepository,
    );
  });

  describe('arquivo', () => {
    it('retorna FILE_REQUIRED sem arquivo e não abre transação', async () => {
      const result = await sut.execute({ file: undefined });

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe(CatalogImportErrorCode.FILE_REQUIRED);
      }
      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it('retorna INVALID_FILE para JSON inválido', async () => {
      const result = await sut.execute(upload('[{"Id": "1", '));

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe(CatalogImportErrorCode.INVALID_FILE);
      }
      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it('retorna INVALID_FILE quando o JSON não é um array', async () => {
      const result = await sut.execute(upload(MEGASTORE_ITEM));

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe(CatalogImportErrorCode.INVALID_FILE);
      }
    });

    it('retorna INVALID_FILE para arquivo vazio (0 bytes)', async () => {
      const result = await sut.execute(upload(''));

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe(CatalogImportErrorCode.INVALID_FILE);
      }
    });

    it('retorna EMPTY_FILE para array sem itens', async () => {
      const result = await sut.execute(upload([]));

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe(CatalogImportErrorCode.EMPTY_FILE);
      }
      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it('aceita arquivo com BOM do UTF-8', async () => {
      const result = await sut.execute(
        upload(`\uFEFF${JSON.stringify([MEGASTORE_ITEM])}`),
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('itens', () => {
    it('cria produto novo (new) e o vínculo com os dados do seller, dentro da transação', async () => {
      const result = await sut.execute(upload([MEGASTORE_ITEM]));

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.totals).toEqual({
        read: 1,
        invalid: 0,
        created: 1,
        linkedExisting: 0,
        alreadyLinked: 0,
        duplicateSameSeller: 0,
      });
      expect(result.value.items[0]).toEqual({
        index: 0,
        externalId: MEGASTORE_ITEM.Id,
        sellerName: 'MegaStore',
        name: 'Smartphone Galaxy S23',
        outcome: ImportItemOutcome.CREATED,
        productId: 10,
        matchedBy: MatchedBy.NEW,
        reason: null,
      });
      expect(transactionManager.run).toHaveBeenCalledTimes(1);
      expect(productRepository.create).toHaveBeenCalledWith(
        {
          name: 'Smartphone Galaxy S23',
          brand: 'Samsung',
          category: 'Electronics',
          normalizedKey: 'samsung|smartphone galaxy s23',
        },
        tx,
      );
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        {
          productId: 10,
          sellerId: 1,
          externalId: MEGASTORE_ITEM.Id,
          name: 'Smartphone Galaxy S23',
          brand: 'Samsung',
          category: 'Electronics',
          matchedBy: MatchedBy.NEW,
        },
        tx,
      );
    });

    it('liga a produto existente pela chave normalizada (normalized_key) sem criar produto', async () => {
      productRepository.findByNormalizedKey.mockResolvedValue(
        product(7, 'samsung|smartphone galaxy s23'),
      );

      const result = await sut.execute(
        upload([{ ...MEGASTORE_ITEM, Name: 'Smartphone  Galaxy S23' }]),
      );

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.items[0]).toMatchObject({
        outcome: ImportItemOutcome.LINKED_EXISTING,
        productId: 7,
        matchedBy: MatchedBy.NORMALIZED_KEY,
      });
      expect(productRepository.findByNormalizedKey).toHaveBeenCalledWith(
        'samsung|smartphone galaxy s23',
        tx,
      );
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 7,
          name: 'Smartphone  Galaxy S23',
          matchedBy: MatchedBy.NORMALIZED_KEY,
        }),
        tx,
      );
    });

    it('reenvio do mesmo externalId pelo mesmo seller atualiza os dados do seller e não roda o matching', async () => {
      sellerRepository.findByName.mockResolvedValue(seller(3, 'MegaStore'));
      sellerProductRepository.findBySellerAndExternalId.mockResolvedValue(
        link({
          id: 55,
          productId: 9,
          sellerId: 3,
          externalId: MEGASTORE_ITEM.Id,
        }),
      );
      sellerProductRepository.updateSellerData.mockResolvedValue(
        link({ id: 55, productId: 9, matchedBy: MatchedBy.NORMALIZED_KEY }),
      );

      const result = await sut.execute(upload([MEGASTORE_ITEM]));

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.totals.alreadyLinked).toBe(1);
      expect(result.value.items[0]).toMatchObject({
        outcome: ImportItemOutcome.ALREADY_LINKED,
        productId: 9,
        matchedBy: MatchedBy.NORMALIZED_KEY,
        reason: null,
      });
      expect(
        sellerProductRepository.findBySellerAndExternalId,
      ).toHaveBeenCalledWith(3, MEGASTORE_ITEM.Id, tx);
      expect(sellerProductRepository.updateSellerData).toHaveBeenCalledWith(
        55,
        {
          name: 'Smartphone Galaxy S23',
          brand: 'Samsung',
          category: 'Electronics',
        },
        tx,
      );
      expect(productRepository.findByNormalizedKey).not.toHaveBeenCalled();
      expect(productRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).not.toHaveBeenCalled();
      expect(sellerRepository.create).not.toHaveBeenCalled();
    });

    it('mesmo Id em sellers diferentes com produtos diferentes cria dois vínculos, sem conflito', async () => {
      const sharedId = '00112233-4455-4667-7889-900112233445';

      const result = await sut.execute(
        upload([
          {
            Id: sharedId,
            SellerName: 'GardenStore',
            Name: 'Curtain Rod',
            Brand: 'IKEA',
          },
          {
            Id: sharedId,
            SellerName: 'SportsHub',
            Name: 'Bookshelf',
            Brand: 'IKEA',
          },
        ]),
      );

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.totals.created).toBe(2);
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

    it('mesmo produto enviado duas vezes pelo mesmo seller com Ids diferentes: vale o primeiro', async () => {
      // O 2º item enxerga, na mesma transação, o produto e o vínculo gravados pelo 1º.
      productRepository.findByNormalizedKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          product(10, 'spalding|basketball spalding official'),
        );
      sellerProductRepository.findBySellerAndProduct.mockResolvedValueOnce(
        link({ id: 100, productId: 10, sellerId: 1, externalId: 'id-1' }),
      );

      const result = await sut.execute(
        upload([
          {
            Id: 'id-1',
            SellerName: 'OfficeSupply',
            Name: 'Basketball Spalding Official',
            Brand: 'Spalding',
          },
          {
            Id: 'id-2',
            SellerName: 'OfficeSupply',
            Name: 'Basketball Spalding  Official',
            Brand: 'Spalding',
          },
        ]),
      );

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.totals).toMatchObject({
        created: 1,
        duplicateSameSeller: 1,
      });
      expect(result.value.items[1]).toMatchObject({
        outcome: ImportItemOutcome.DUPLICATE_SAME_SELLER,
        productId: 10,
        matchedBy: null,
      });
      expect(result.value.items[1].reason).toContain('"id-1"');
      expect(
        sellerProductRepository.findBySellerAndProduct,
      ).toHaveBeenCalledWith(1, 10, tx);
      expect(productRepository.create).toHaveBeenCalledTimes(1);
      expect(sellerProductRepository.create).toHaveBeenCalledTimes(1);
      expect(sellerProductRepository.updateSellerData).not.toHaveBeenCalled();
    });

    it('deduplica dentro do arquivo: o item seguinte de outro seller liga ao produto criado pelo anterior', async () => {
      productRepository.findByNormalizedKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(product(10, 'samsung|smartphone galaxy s23'));

      const result = await sut.execute(
        upload([
          MEGASTORE_ITEM,
          {
            ...MEGASTORE_ITEM,
            Id: 'outro-id',
            SellerName: 'FitnessCenter',
            Name: 'Smartphone Galaxy  S23',
          },
        ]),
      );

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.items.map((item) => item.outcome)).toEqual([
        ImportItemOutcome.CREATED,
        ImportItemOutcome.LINKED_EXISTING,
      ]);
      expect(result.value.items[1].productId).toBe(10);
    });

    it('aceita Id fora do formato UUID', async () => {
      const result = await sut.execute(
        upload([{ ...MEGASTORE_ITEM, Id: 'ddddeee-ffff-0000' }]),
      );

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.items[0]).toMatchObject({
        outcome: ImportItemOutcome.CREATED,
        externalId: 'ddddeee-ffff-0000',
      });
    });

    it('rejeita item sem Id, sem SellerName ou sem Name, com motivo, e importa os demais', async () => {
      const result = await sut.execute(
        upload([
          { SellerName: 'MegaStore', Name: 'Sem Id' },
          { Id: 'x-2', SellerName: '  ', Name: 'Seller vazio' },
          { Id: 'x-3', SellerName: 'MegaStore', Name: null },
          { Id: 4, SellerName: 'MegaStore', Name: 'Id numérico' },
          'não é objeto',
          MEGASTORE_ITEM,
        ]),
      );

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.totals).toMatchObject({
        read: 6,
        invalid: 5,
        created: 1,
      });
      expect(result.value.items.map((item) => item.reason)).toEqual([
        'Id ausente.',
        'SellerName vazio.',
        'Name ausente.',
        'Id precisa ser texto.',
        'O item não é um objeto JSON.',
        null,
      ]);
      expect(result.value.items[1]).toMatchObject({
        index: 1,
        outcome: ImportItemOutcome.INVALID,
        externalId: 'x-2',
        sellerName: '  ',
        productId: null,
        matchedBy: null,
      });
      expect(sellerRepository.findByName).toHaveBeenCalledTimes(1);
      expect(productRepository.create).toHaveBeenCalledTimes(1);
    });

    it('lista todos os motivos quando o item tem mais de um problema', async () => {
      const result = await sut.execute(upload([{ Brand: 3 }]));

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.items[0].reason).toBe(
        'Id ausente. SellerName ausente. Name ausente. Brand precisa ser texto ou null.',
      );
      expect(transactionManager.run).toHaveBeenCalledTimes(1);
      expect(sellerRepository.findByName).not.toHaveBeenCalled();
    });

    it('aceita Brand null e Category ausente, gravando null e chave |nome', async () => {
      const result = await sut.execute(
        upload([
          {
            Id: 'k-1',
            SellerName: 'HomeStore',
            Name: 'Cable Organizer Kit',
            Brand: null,
          },
        ]),
      );

      expect(result.isSuccess).toBe(true);
      expect(productRepository.create).toHaveBeenCalledWith(
        {
          name: 'Cable Organizer Kit',
          brand: null,
          category: null,
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

      const result = await sut.execute(
        upload([{ ...MEGASTORE_ITEM, Brand: malicious }]),
      );

      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.items[0].outcome).toBe(ImportItemOutcome.CREATED);
      expect(productRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          brand: malicious,
          normalizedKey: normalizer.buildKey(malicious, MEGASTORE_ITEM.Name),
        }),
        tx,
      );
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ brand: malicious }),
        tx,
      );
    });

    it("grava Levi's e textos com espaços sem alteração (trim só na validação)", async () => {
      const result = await sut.execute(
        upload([
          {
            Id: ' l-1 ',
            SellerName: 'FashionHub',
            Name: ' Jeans 501  Original ',
            Brand: "Levi's",
          },
        ]),
      );

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
      const result = await sut.execute(
        upload([
          MEGASTORE_ITEM,
          {
            ...MEGASTORE_ITEM,
            Id: 'b-2',
            Name: 'Notebook Dell XPS 13',
            Brand: 'Dell',
          },
        ]),
      );

      expect(result.isSuccess).toBe(true);
      expect(sellerRepository.findByName).toHaveBeenCalledTimes(1);
      expect(sellerRepository.findByName).toHaveBeenCalledWith('MegaStore', tx);
      expect(sellerRepository.create).toHaveBeenCalledTimes(1);
      expect(sellerRepository.create).toHaveBeenCalledWith('MegaStore', tx);
      expect(sellerProductRepository.create).toHaveBeenCalledTimes(2);
    });

    it('usa o seller existente sem criar outro', async () => {
      sellerRepository.findByName.mockResolvedValue(seller(8, 'MegaStore'));

      const result = await sut.execute(upload([MEGASTORE_ITEM]));

      expect(result.isSuccess).toBe(true);
      expect(sellerRepository.create).not.toHaveBeenCalled();
      expect(sellerProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sellerId: 8 }),
        tx,
      );
    });
  });
});
