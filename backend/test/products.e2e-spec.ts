import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { LegacyDatabase } from '@test/helpers/legacy-database';
import { configureApp } from '@shared/config/configure-app';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';

interface ListBody {
  items: {
    id: number;
    name: string;
    brand: string | null;
    sellersCount: number;
  }[];
  total: number;
  page: number;
  pageSize: number;
}

interface DetailBody {
  id: number;
  brand: string | null;
  sellers: {
    sellerId: number;
    sellerName: string;
    externalId: string | null;
    brand: string | null;
    category: string | null;
    matchedBy: string;
  }[];
}

const MALICIOUS_BRAND = "TestBrand'; SELECT 1; --";

describe('Products e2e', () => {
  let app: INestApplication;
  let database: LegacyDatabase;
  let prisma: PrismaService;
  const normalizer = new ProductNormalizerService();
  const ids: Record<string, number> = {};

  async function createProduct(
    key: string,
    name: string,
    brand: string | null,
  ): Promise<number> {
    const product = await prisma.product.create({
      data: {
        name,
        brand,
        category: 'Cat',
        normalizedKey: normalizer.buildKey(brand, name),
      },
    });
    ids[key] = product.id;
    return product.id;
  }

  beforeAll(async () => {
    database = LegacyDatabase.create();
    await database.migrate();
    process.env.DATABASE_URL = database.url;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.sellerProduct.deleteMany();
    await prisma.product.deleteMany();
    await prisma.seller.deleteMany();

    const tenis = await createProduct('tenis', 'Tênis Air Max', 'Nike');
    await createProduct('levis', 'Jeans 501', "Levi's");
    await createProduct('malicious', 'Camiseta', MALICIOUS_BRAND);
    const sellerA = await prisma.seller.create({
      data: { sellerName: 'Loja A' },
    });
    const sellerB = await prisma.seller.create({
      data: { sellerName: 'Loja B' },
    });
    await prisma.sellerProduct.create({
      data: {
        productId: tenis,
        sellerId: sellerA.id,
        externalId: 'A-1',
        name: 'Tênis Air Max',
        brand: 'Nike',
        category: 'Cat',
        matchedBy: 'new',
      },
    });
    await prisma.sellerProduct.create({
      data: {
        productId: tenis,
        sellerId: sellerB.id,
        externalId: null,
        name: 'TENIS  AIR MAX',
        brand: null,
        category: null,
        matchedBy: 'normalized_key',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await database.cleanup();
  });

  const http = () => request(app.getHttpServer() as App);
  const bodyOf = async (req: request.Test): Promise<unknown> =>
    (await req).body as unknown;

  describe('GET /api/products', () => {
    it('lista com paginação padrão e contagem de sellers', async () => {
      const body = await bodyOf(http().get('/api/products').expect(200));
      const list = body as ListBody;

      expect(list.total).toBe(3);
      expect(list.page).toBe(1);
      expect(list.pageSize).toBe(20);
      expect(list.items.map((i) => i.id)).toEqual([
        ids.tenis,
        ids.levis,
        ids.malicious,
      ]);
      expect(list.items[0].sellersCount).toBe(2);
      expect(list.items[1].sellersCount).toBe(0);
    });

    it('lê marca com aspa e com texto malicioso exatamente iguais', async () => {
      const body = await bodyOf(http().get('/api/products').expect(200));
      const brands = (body as ListBody).items.map((i) => i.brand);

      expect(brands).toContain("Levi's");
      expect(brands).toContain(MALICIOUS_BRAND);
    });

    it('pagina', async () => {
      const body = await bodyOf(
        http().get('/api/products?page=2&pageSize=2').expect(200),
      );
      const list = body as ListBody;

      expect(list.total).toBe(3);
      expect(list.items.map((i) => i.id)).toEqual([ids.malicious]);
    });

    it.each(['TÊNIS', 'tenis%20%20air', 'nike'])(
      'busca "%s" ignora acento, maiúscula e espaço duplo',
      async (q) => {
        const body = await bodyOf(
          http().get(`/api/products?q=${q}`).expect(200),
        );
        const list = body as ListBody;

        expect(list.items.map((i) => i.id)).toEqual([ids.tenis]);
        expect(list.total).toBe(1);
      },
    );

    it('busca termo malicioso sem quebrar nada', async () => {
      const q = encodeURIComponent("'; DROP TABLE Product; --");
      const body = await bodyOf(http().get(`/api/products?q=${q}`).expect(200));
      expect((body as ListBody).total).toBe(0);

      const after = await http().get('/api/products').expect(200);
      expect((after.body as ListBody).total).toBe(3);
    });

    it('encontra o produto pela marca maliciosa', async () => {
      const q = encodeURIComponent('testbrand; select 1; --');
      const body = await bodyOf(http().get(`/api/products?q=${q}`).expect(200));
      expect((body as ListBody).items.map((i) => i.id)).toEqual([
        ids.malicious,
      ]);
    });

    it.each(['pageSize=101', 'pageSize=0', 'page=0', 'page=abc'])(
      'responde 400 para %s',
      async (qs) => {
        await http().get(`/api/products?${qs}`).expect(400);
      },
    );
  });

  describe('GET /api/products/:id', () => {
    it('devolve o produto com os sellers e o que cada um enviou', async () => {
      const body = await bodyOf(
        http().get(`/api/products/${ids.tenis}`).expect(200),
      );
      const detail = body as DetailBody;

      expect(detail.id).toBe(ids.tenis);
      expect(detail.sellers).toHaveLength(2);
      expect(detail.sellers[0]).toMatchObject({
        sellerName: 'Loja A',
        externalId: 'A-1',
        matchedBy: 'new',
      });
      expect(detail.sellers[1]).toMatchObject({
        sellerName: 'Loja B',
        externalId: null,
        name: 'TENIS  AIR MAX',
        matchedBy: 'normalized_key',
      });
    });

    it('usa marca e categoria do produto oficial quando o seller não informou', async () => {
      const body = await bodyOf(
        http().get(`/api/products/${ids.tenis}`).expect(200),
      );
      const loose = (body as DetailBody).sellers[1];

      expect(loose.brand).toBe('Nike');
      expect(loose.category).toBe('Cat');

      const stored = await prisma.sellerProduct.findFirstOrThrow({
        where: { productId: ids.tenis, externalId: null },
      });
      expect(stored.brand).toBeNull();
      expect(stored.category).toBeNull();
    });

    it('devolve a marca com aspa exatamente igual', async () => {
      const body = await bodyOf(
        http().get(`/api/products/${ids.levis}`).expect(200),
      );
      expect((body as DetailBody).brand).toBe("Levi's");
    });

    it('responde 404 com PRODUCT_NOT_FOUND', async () => {
      const body = await bodyOf(http().get('/api/products/999999').expect(404));
      expect((body as { code: string }).code).toBe('PRODUCT_NOT_FOUND');
    });

    it('responde 400 para id inválido', async () => {
      await http().get('/api/products/abc').expect(400);
    });
  });
});
