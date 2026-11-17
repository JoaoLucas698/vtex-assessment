import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { LEGACY_NORMALIZATION_TYPE_ID } from '@modules/normalization-types/consts/normalization-types.consts';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { configureApp } from '@shared/config/configure-app';
import { PrismaService } from '@shared/prisma/prisma.service';
import { LegacyDatabase } from '@test/helpers/legacy-database';

const MALICIOUS_NAME = "x'; SELECT 1; --";

interface SellersBody {
  items: { id: number; sellerName: string; productCount: number }[];
  total: number;
  page: number;
  pageSize: number;
}

interface ProductsBody {
  seller: { id: number; sellerName: string };
  items: {
    externalId: string | null;
    name: string;
    brand: string | null;
    category: string | null;
    matchedBy: string;
    product: { id: number; name: string };
  }[];
  total: number;
}

describe('Sellers e2e', () => {
  let app: INestApplication;
  let database: LegacyDatabase;
  let maliciousSellerId: number;
  let emptySellerId: number;

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

    const prisma = app.get(PrismaService);
    await prisma.sellerProduct.deleteMany();
    await prisma.seller.deleteMany();
    await prisma.product.deleteMany();

    const sellerRepository = app.get(SellerRepository);
    const sellerProductRepository = app.get(SellerProductRepository);
    const product = await prisma.product.create({
      data: {
        name: 'Produto Oficial',
        normalizationTypeId: LEGACY_NORMALIZATION_TYPE_ID,
        normalizedKey: 'produto|oficial',
      },
    });
    const malicious = await sellerRepository.create(MALICIOUS_NAME);
    maliciousSellerId = malicious.id;
    emptySellerId = (await sellerRepository.create('Loja Vazia')).id;
    await sellerProductRepository.create({
      productId: product.id,
      sellerId: malicious.id,
      externalId: 'E1',
      name: "Nome'; DROP TABLE Seller; --",
      brand: null,
      category: null,
      matchedBy: 'new',
    });
  });

  afterAll(async () => {
    await app.close();
    await database.cleanup();
  });

  it('GET /api/sellers lista sellers com contagem e nome malicioso intacto', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/api/sellers')
      .expect(200);
    const body = response.body as SellersBody;

    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    const malicious = body.items.find((s) => s.id === maliciousSellerId);
    expect(malicious).toEqual({
      id: maliciousSellerId,
      sellerName: MALICIOUS_NAME,
      productCount: 1,
    });
    expect(body.items.find((s) => s.id === emptySellerId)?.productCount).toBe(
      0,
    );
  });

  it('GET /api/sellers respeita a paginação', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/api/sellers?page=2&pageSize=1')
      .expect(200);
    const body = response.body as SellersBody;

    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(2);
  });

  it('GET /api/sellers responde 400 com pageSize acima do máximo', async () => {
    await request(app.getHttpServer() as App)
      .get('/api/sellers?pageSize=101')
      .expect(400);
  });

  it('GET /api/sellers/:id/products devolve os dados do seller, com null preservado', async () => {
    const response = await request(app.getHttpServer() as App)
      .get(`/api/sellers/${maliciousSellerId}/products`)
      .expect(200);
    const body = response.body as ProductsBody;

    expect(body.seller.sellerName).toBe(MALICIOUS_NAME);
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      externalId: 'E1',
      name: "Nome'; DROP TABLE Seller; --",
      brand: null,
      category: null,
      matchedBy: 'new',
      product: { name: 'Produto Oficial' },
    });
  });

  it('GET /api/sellers/:id/products responde 404 SELLER_NOT_FOUND', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/api/sellers/999999/products')
      .expect(404);

    expect((response.body as { code: string }).code).toBe('SELLER_NOT_FOUND');
  });

  it('GET /api/sellers/:id/products responde 400 com id inválido', async () => {
    await request(app.getHttpServer() as App)
      .get('/api/sellers/abc/products')
      .expect(400);
  });
});
