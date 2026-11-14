import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { configureApp } from '@shared/config/configure-app';

describe('Setup e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = `file:${join(tmpdir(), 'catalog-e2e-setup.db').replaceAll('\\', '/')}`;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/docs-json responde 200 com o documento OpenAPI', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/api/docs-json')
      .expect(200);
    expect((response.body as { info: { title: string } }).info.title).toBe(
      'Catalog Consolidation API',
    );
  });
});
