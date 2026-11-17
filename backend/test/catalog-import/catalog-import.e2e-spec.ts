import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { resolve } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { CatalogImportErrorCode } from '@modules/catalog-import/schemas/catalog-import.errors';
import { MAX_CATALOG_FILE_SIZE_BYTES } from '@modules/catalog-import/consts/catalog-import.consts';
import {
  ImportItemOutcome,
  MatchedBy,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import { NORMALIZATION_TYPE_IDS } from '@modules/normalization-types/consts/normalization-types.consts';
import { NormalizationTypeCode } from '@modules/normalization-types/schemas/normalization-type.types';
import { configureApp } from '@shared/config/configure-app';
import { CommonErrorCode } from '@shared/errors/error-codes';
import { PrismaService } from '@shared/prisma/prisma.service';
import { EmptyDatabase } from '@test/catalog-import/empty-database';
import { LegacyDatabase } from '@test/helpers/legacy-database';

const CARGA_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'database',
  'fixtures',
  'carga.json',
);
const ENDPOINT = '/api/catalog-import';
const MALICIOUS_BRAND = "TestBrand'; SELECT 1; --";
const LEVIS_BRAND = "Levi's";
const MALICIOUS_CATEGORY = "x'; SELECT 1; --";
const NAME_BRAND_ID = NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_BRAND];
const NAME_CATEGORY_ID =
  NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_CATEGORY];
/** Regras dos tipos cadastrados pela migration (D-110). */
const NAME_BRAND_RULE = { includesBrand: true, includesCategory: false };
const NAME_CATEGORY_RULE = { includesBrand: false, includesCategory: true };
/** O Prisma interativo tem timeout padrão de 5 s; o arquivo inteiro roda numa transação. */
const IMPORT_TIMEOUT_MS = 60_000;

interface ReportBody {
  normalizationType: string;
  totals: {
    read: number;
    invalid: number;
    created: number;
    linkedExisting: number;
    alreadyLinked: number;
    duplicateSameSeller: number;
  };
  items: {
    index: number;
    externalId: string | null;
    sellerName: string | null;
    name: string | null;
    outcome: ImportItemOutcome;
    productId: number | null;
    matchedBy: string | null;
    reason: string | null;
  }[];
}

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

interface Counts {
  products: number;
  links: number;
  sellers: number;
  multiSellerProducts: number;
}

async function createApp(databaseUrl: string): Promise<INestApplication> {
  process.env.DATABASE_URL = databaseUrl;
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

async function importCarga(
  app: INestApplication,
  normalizationType?: NormalizationTypeCode,
): Promise<ReportBody> {
  const call = request(app.getHttpServer() as App).post(ENDPOINT);
  if (normalizationType) call.field('normalizationType', normalizationType);
  const response = await call.attach('file', CARGA_PATH).expect(200);
  return response.body as ReportBody;
}

/** Importa um arquivo montado no próprio teste. */
async function importItems(
  app: INestApplication,
  items: Record<string, unknown>[],
  normalizationType?: NormalizationTypeCode,
): Promise<ReportBody> {
  const call = request(app.getHttpServer() as App).post(ENDPOINT);
  if (normalizationType) call.field('normalizationType', normalizationType);
  const response = await call
    .attach('file', Buffer.from(JSON.stringify(items)), 'carga.json')
    .expect(200);
  return response.body as ReportBody;
}

async function expectIntegrity(prisma: PrismaService): Promise<void> {
  const integrity = await prisma.$queryRaw<
    { integrity_check: string }[]
  >`PRAGMA integrity_check`;
  expect(integrity).toEqual([{ integrity_check: 'ok' }]);
}

async function countAll(prisma: PrismaService): Promise<Counts> {
  const [products, links, sellers, linksByProduct] = await Promise.all([
    prisma.product.count(),
    prisma.sellerProduct.count(),
    prisma.seller.count(),
    prisma.sellerProduct.groupBy({ by: ['productId'], _count: { _all: true } }),
  ]);
  return {
    products,
    links,
    sellers,
    multiSellerProducts: linksByProduct.filter((g) => g._count._all > 1).length,
  };
}

/** Confere as invariantes do catálogo: nada repetido onde o domínio proíbe. */
async function expectNoDuplicates(prisma: PrismaService): Promise<void> {
  const [repeatedKeys, repeatedProductSeller, repeatedExternalIds] =
    await Promise.all([
      prisma.product.groupBy({
        by: ['normalizationTypeId', 'normalizedKey'],
        _count: { _all: true },
        having: { normalizedKey: { _count: { gt: 1 } } },
      }),
      prisma.sellerProduct.groupBy({
        by: ['productId', 'sellerId'],
        _count: { _all: true },
        having: { productId: { _count: { gt: 1 } } },
      }),
      prisma.sellerProduct.groupBy({
        by: ['sellerId', 'externalId'],
        where: { externalId: { not: null } },
        _count: { _all: true },
        having: { sellerId: { _count: { gt: 1 } } },
      }),
    ]);
  expect(repeatedKeys).toHaveLength(0);
  expect(repeatedProductSeller).toHaveLength(0);
  expect(repeatedExternalIds).toHaveLength(0);
}

function countMatchedBy(report: ReportBody, matchedBy: MatchedBy): number {
  return report.items.filter(
    (item) =>
      item.matchedBy === matchedBy &&
      item.outcome !== ImportItemOutcome.ALREADY_LINKED,
  ).length;
}

describe('Catalog import e2e: catálogo vazio', () => {
  let app: INestApplication;
  let database: EmptyDatabase;
  let prisma: PrismaService;
  let report: ReportBody;

  beforeAll(async () => {
    database = EmptyDatabase.create();
    app = await createApp(database.url);
    prisma = app.get(PrismaService);
    report = await importCarga(app);
  }, IMPORT_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    database.cleanup();
  });

  it('sem normalizationType usa NAME_BRAND e cria todos os produtos com a chave marca|nome', async () => {
    const normalizer = new ProductNormalizerService();
    const products = await prisma.product.findMany();

    expect(report.normalizationType).toBe(NormalizationTypeCode.NAME_BRAND);
    expect(products.every((p) => p.normalizationTypeId === NAME_BRAND_ID)).toBe(
      true,
    );
    expect(
      products.filter(
        (p) => p.normalizedKey !== normalizer.buildKey(p, NAME_BRAND_RULE),
      ),
    ).toEqual([]);
  });

  it('devolve os totais de docs/context.md §8', () => {
    expect(report.totals).toEqual({
      read: 269,
      invalid: 0,
      created: 201,
      linkedExisting: 56,
      alreadyLinked: 1,
      duplicateSameSeller: 11,
    });
  });

  it('lista um item por linha do arquivo, na ordem, com matchedBy coerente', () => {
    expect(report.items).toHaveLength(269);
    expect(report.items.map((item) => item.index)).toEqual(
      Array.from({ length: 269 }, (_, index) => index),
    );
    expect(countMatchedBy(report, MatchedBy.NEW)).toBe(201);
    expect(countMatchedBy(report, MatchedBy.NORMALIZED_KEY)).toBe(56);
    const duplicates = report.items.filter(
      (item) => item.outcome === ImportItemOutcome.DUPLICATE_SAME_SELLER,
    );
    expect(duplicates.every((item) => item.reason && item.productId)).toBe(
      true,
    );
  });

  it('grava 201 produtos, 257 vínculos e 54 produtos com mais de 1 seller', async () => {
    const counts = await countAll(prisma);

    expect(counts.products).toBe(201);
    expect(counts.links).toBe(257);
    expect(counts.sellers).toBe(20);
    expect(counts.multiSellerProducts).toBe(54);
    expect(
      await prisma.sellerProduct.count({ where: { matchedBy: MatchedBy.NEW } }),
    ).toBe(201);
    expect(
      await prisma.sellerProduct.count({
        where: { matchedBy: MatchedBy.NORMALIZED_KEY },
      }),
    ).toBe(56);
    await expectNoDuplicates(prisma);
  });
});

describe('Catalog import e2e: banco fornecido (cópia migrada)', () => {
  let app: INestApplication;
  let database: LegacyDatabase;
  let prisma: PrismaService;
  let before: Counts;
  let first: ReportBody;
  let afterFirst: Counts;

  beforeAll(async () => {
    database = LegacyDatabase.create();
    await database.migrate();
    app = await createApp(database.url);
    prisma = app.get(PrismaService);
    before = await countAll(prisma);
    first = await importCarga(app);
    afterFirst = await countAll(prisma);
  }, IMPORT_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await database.cleanup();
  });

  it('parte dos 975 produtos do banco fornecido, sem vínculos', () => {
    expect(before).toEqual({
      products: 975,
      links: 0,
      sellers: 0,
      multiSellerProducts: 0,
    });
  });

  it('liga a maior parte dos itens aos produtos existentes', () => {
    expect(first.totals).toEqual({
      read: 269,
      invalid: 0,
      created: 3,
      linkedExisting: 254,
      alreadyLinked: 1,
      duplicateSameSeller: 11,
    });
    expect(afterFirst).toEqual({
      products: 978,
      links: 257,
      sellers: 20,
      multiSellerProducts: 54,
    });
  });

  it('não deixa normalizedKey nem vínculo repetido', async () => {
    await expectNoDuplicates(prisma);
  });

  it('grava o brand com tentativa de SQL injection com o texto exato e mantém as tabelas íntegras', async () => {
    const links = await prisma.sellerProduct.findMany({
      where: { brand: MALICIOUS_BRAND },
      include: { seller: true },
    });

    expect(links).toHaveLength(1);
    expect(links[0].seller.sellerName).toBe('MegaStore');
    expect(links[0].brand).toBe(MALICIOUS_BRAND);
    await expectIntegrity(prisma);
  });

  it("grava Levi's sem alterar a aspa", async () => {
    const levis = await prisma.sellerProduct.count({
      where: { brand: LEVIS_BRAND },
    });
    const stripped = await prisma.sellerProduct.count({
      where: { brand: 'Levis' },
    });

    expect(levis).toBeGreaterThan(0);
    expect(stripped).toBe(0);
  });

  it(
    'reimportar o arquivo não muda nenhuma contagem e reporta tudo como já vinculado ou duplicado',
    async () => {
      const second = await importCarga(app);
      const afterSecond = await countAll(prisma);

      expect(afterSecond).toEqual(afterFirst);
      expect(second.totals).toEqual({
        read: 269,
        invalid: 0,
        created: 0,
        linkedExisting: 0,
        alreadyLinked: 258,
        duplicateSameSeller: 11,
      });
      await expectNoDuplicates(prisma);
    },
    IMPORT_TIMEOUT_MS,
  );
});

describe('Catalog import e2e: arquivo rejeitado', () => {
  let app: INestApplication;
  let database: EmptyDatabase;
  let prisma: PrismaService;

  beforeAll(async () => {
    database = EmptyDatabase.create();
    app = await createApp(database.url);
    prisma = app.get(PrismaService);
  }, IMPORT_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    database.cleanup();
  });

  it('responde 400 INVALID_FILE para JSON quebrado e não grava nada', async () => {
    const response = await request(app.getHttpServer() as App)
      .post(ENDPOINT)
      .attach('file', Buffer.from('[{"Id": "1", "SellerName": '), 'carga.json')
      .expect(400);

    expect((response.body as ErrorBody).code).toBe(
      CatalogImportErrorCode.INVALID_FILE,
    );
    expect(await prisma.product.count()).toBe(0);
  });

  it('responde 400 INVALID_FILE quando o JSON não é um array', async () => {
    const response = await request(app.getHttpServer() as App)
      .post(ENDPOINT)
      .attach('file', Buffer.from('{"Id": "1"}'), 'carga.json')
      .expect(400);

    expect((response.body as ErrorBody).code).toBe(
      CatalogImportErrorCode.INVALID_FILE,
    );
  });

  it('responde 400 EMPTY_FILE para array vazio', async () => {
    const response = await request(app.getHttpServer() as App)
      .post(ENDPOINT)
      .attach('file', Buffer.from('[]'), 'carga.json')
      .expect(400);

    expect((response.body as ErrorBody).code).toBe(
      CatalogImportErrorCode.EMPTY_FILE,
    );
  });

  it.each(['NAME_COLOR', 'name_brand', '', MALICIOUS_CATEGORY])(
    'responde 400 INVALID_NORMALIZATION_TYPE para normalizationType "%s" e não grava nada',
    async (normalizationType) => {
      const response = await request(app.getHttpServer() as App)
        .post(ENDPOINT)
        .field('normalizationType', normalizationType)
        .attach('file', CARGA_PATH)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: CatalogImportErrorCode.INVALID_NORMALIZATION_TYPE,
      });
      expect(await prisma.product.count()).toBe(0);
      expect(await prisma.seller.count()).toBe(0);
    },
  );

  it('responde 400 FILE_REQUIRED sem arquivo', async () => {
    const response = await request(app.getHttpServer() as App)
      .post(ENDPOINT)
      .field('other', 'x')
      .expect(400);

    expect((response.body as ErrorBody).code).toBe(
      CatalogImportErrorCode.FILE_REQUIRED,
    );
  });

  it('responde 413 para arquivo acima de 5 MB', async () => {
    const response = await request(app.getHttpServer() as App)
      .post(ENDPOINT)
      .attach(
        'file',
        Buffer.alloc(MAX_CATALOG_FILE_SIZE_BYTES + 1, ' '),
        'carga.json',
      )
      .expect(413);

    expect(response.body).toMatchObject({
      statusCode: 413,
      code: CommonErrorCode.PAYLOAD_TOO_LARGE,
    });
  });

  it('rejeita itens inválidos individualmente, com o motivo, e importa os válidos', async () => {
    const items = [
      { Id: 'x-1', SellerName: 'Loja Nova', Name: 'Produto A', Brand: null },
      { SellerName: 'Loja Nova', Name: 'Produto B' },
      { Id: 'x-3', SellerName: '   ', Name: 'Produto C' },
    ];
    const response = await request(app.getHttpServer() as App)
      .post(ENDPOINT)
      .attach('file', Buffer.from(JSON.stringify(items)), 'carga.json')
      .expect(200);
    const body = response.body as ReportBody;

    expect(body.totals).toMatchObject({ read: 3, invalid: 2, created: 1 });
    expect(body.items[1]).toMatchObject({
      outcome: ImportItemOutcome.INVALID,
      reason: 'Id ausente.',
      productId: null,
    });
    expect(body.items[2]).toMatchObject({
      outcome: ImportItemOutcome.INVALID,
      reason: 'SellerName vazio.',
    });
    expect(
      await prisma.product.findFirst({ where: { name: 'Produto A' } }),
    ).toMatchObject({ brand: null, normalizedKey: '|produto a' });
  });
});

describe('Catalog import e2e: tipo NAME_CATEGORY (catálogo vazio)', () => {
  const normalizer = new ProductNormalizerService();
  let app: INestApplication;
  let database: EmptyDatabase;
  let prisma: PrismaService;
  let first: ReportBody;
  let afterFirst: Counts;

  beforeAll(async () => {
    database = EmptyDatabase.create();
    app = await createApp(database.url);
    prisma = app.get(PrismaService);
    first = await importCarga(app, NormalizationTypeCode.NAME_CATEGORY);
    afterFirst = await countAll(prisma);
  }, IMPORT_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    database.cleanup();
  });

  it('devolve o tipo usado e cria os produtos com o tipo 2 e a chave categoria|nome', async () => {
    const products = await prisma.product.findMany();

    expect(first.normalizationType).toBe(NormalizationTypeCode.NAME_CATEGORY);
    expect(products).toHaveLength(first.totals.created);
    expect(first.totals.created).toBeGreaterThan(0);
    expect(
      products.every((p) => p.normalizationTypeId === NAME_CATEGORY_ID),
    ).toBe(true);
    expect(
      products.filter(
        (p) => p.normalizedKey !== normalizer.buildKey(p, NAME_CATEGORY_RULE),
      ),
    ).toEqual([]);
    expect(first.totals.read).toBe(269);
    await expectNoDuplicates(prisma);
  });

  it(
    'reimportar o mesmo arquivo com NAME_CATEGORY é idempotente',
    async () => {
      const second = await importCarga(
        app,
        NormalizationTypeCode.NAME_CATEGORY,
      );
      const afterSecond = await countAll(prisma);

      expect(afterSecond).toEqual(afterFirst);
      expect(second.normalizationType).toBe(
        NormalizationTypeCode.NAME_CATEGORY,
      );
      expect(second.totals).toMatchObject({ created: 0, linkedExisting: 0 });
      expect(
        second.totals.alreadyLinked + second.totals.duplicateSameSeller,
      ).toBe(269);
      await expectNoDuplicates(prisma);
    },
    IMPORT_TIMEOUT_MS,
  );

  it('grava a categoria com tentativa de SQL injection com o texto exato e a chave funciona', async () => {
    const created = await importItems(
      app,
      [
        {
          Id: 'mal-1',
          SellerName: 'Loja Maliciosa A',
          Name: 'Produto Malicioso E2E',
          Brand: 'Acme',
          Category: MALICIOUS_CATEGORY,
        },
      ],
      NormalizationTypeCode.NAME_CATEGORY,
    );
    const linked = await importItems(
      app,
      [
        {
          Id: 'mal-2',
          SellerName: 'Loja Maliciosa B',
          Name: 'produto  malicioso e2e',
          Brand: 'Outra Marca',
          Category: MALICIOUS_CATEGORY,
        },
      ],
      NormalizationTypeCode.NAME_CATEGORY,
    );

    expect(created.items[0].outcome).toBe(ImportItemOutcome.CREATED);
    expect(linked.items[0]).toMatchObject({
      outcome: ImportItemOutcome.LINKED_EXISTING,
      productId: created.items[0].productId,
      matchedBy: MatchedBy.NORMALIZED_KEY,
    });
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: created.items[0].productId as number },
    });
    expect(product).toMatchObject({
      category: MALICIOUS_CATEGORY,
      normalizationTypeId: NAME_CATEGORY_ID,
      normalizedKey: 'x; select 1; --|produto malicioso e2e',
    });
    expect(
      await prisma.sellerProduct.count({
        where: { category: MALICIOUS_CATEGORY },
      }),
    ).toBe(2);
    await expectIntegrity(prisma);
  });
});

describe('Catalog import e2e: produtos de tipos diferentes (banco fornecido)', () => {
  let app: INestApplication;
  let database: LegacyDatabase;
  let prisma: PrismaService;
  let legacy: {
    id: number;
    name: string;
    brand: string | null;
    category: string | null;
  };

  beforeAll(async () => {
    database = LegacyDatabase.create();
    await database.migrate();
    app = await createApp(database.url);
    prisma = app.get(PrismaService);
    legacy = await prisma.product.findFirstOrThrow({
      where: {
        normalizationTypeId: NAME_BRAND_ID,
        brand: { not: null },
        category: { not: null },
      },
      orderBy: { id: 'asc' },
    });
  }, IMPORT_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await database.cleanup();
  });

  it('item que bate com um produto legado NAME_BRAND é ligado a ele mesmo importando com NAME_CATEGORY', async () => {
    const productsBefore = await prisma.product.count();

    const report = await importItems(
      app,
      [
        {
          Id: 'tipo-1',
          SellerName: 'Loja Tipos A',
          Name: legacy.name,
          Brand: legacy.brand,
          Category: 'Categoria Diferente E2E',
        },
      ],
      NormalizationTypeCode.NAME_CATEGORY,
    );

    expect(report.normalizationType).toBe(NormalizationTypeCode.NAME_CATEGORY);
    expect(report.items[0]).toMatchObject({
      outcome: ImportItemOutcome.LINKED_EXISTING,
      productId: legacy.id,
      matchedBy: MatchedBy.NORMALIZED_KEY,
    });
    expect(await prisma.product.count()).toBe(productsBefore);
  });

  it('com produtos dos dois tipos batendo, vence o do tipo escolhido na importação', async () => {
    const category = 'Categoria Prioridade E2E';
    // Cria um produto NAME_CATEGORY com o mesmo nome do legado e outra marca.
    const created = await importItems(
      app,
      [
        {
          Id: 'prio-1',
          SellerName: 'Loja Prioridade A',
          Name: legacy.name,
          Brand: 'Marca Inexistente E2E',
          Category: category,
        },
      ],
      NormalizationTypeCode.NAME_CATEGORY,
    );
    const categoryProductId = created.items[0].productId;
    expect(created.items[0].outcome).toBe(ImportItemOutcome.CREATED);
    expect(categoryProductId).not.toBe(legacy.id);

    // Este item bate com os dois: com o legado pela marca e com o novo pela categoria.
    const item = {
      Name: legacy.name,
      Brand: legacy.brand,
      Category: category,
    };
    const byCategory = await importItems(
      app,
      [{ ...item, Id: 'prio-2', SellerName: 'Loja Prioridade B' }],
      NormalizationTypeCode.NAME_CATEGORY,
    );
    const byBrand = await importItems(app, [
      { ...item, Id: 'prio-3', SellerName: 'Loja Prioridade C' },
    ]);

    expect(byCategory.items[0]).toMatchObject({
      outcome: ImportItemOutcome.LINKED_EXISTING,
      productId: categoryProductId,
    });
    expect(byBrand.normalizationType).toBe(NormalizationTypeCode.NAME_BRAND);
    expect(byBrand.items[0]).toMatchObject({
      outcome: ImportItemOutcome.LINKED_EXISTING,
      productId: legacy.id,
    });
    await expectNoDuplicates(prisma);
  });
});
