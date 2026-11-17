import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { LIST_NORMALIZATION_TYPES_OK_EXAMPLE } from '@modules/normalization-types/consts/normalization-types.swagger-examples';
import { configureApp } from '@shared/config/configure-app';
import { LegacyDatabase } from '@test/helpers/legacy-database';

interface ListBody {
  items: {
    id: number;
    code: string;
    description: string;
    includesBrand: boolean;
    includesCategory: boolean;
  }[];
}

describe('Normalization types e2e', () => {
  let app: INestApplication;
  let database: LegacyDatabase;

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
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await database.cleanup();
  });

  it('GET /api/normalization-types lista os 3 tipos em ordem de id', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/api/normalization-types')
      .expect(200);
    const body = response.body as ListBody;

    expect(body).toEqual(LIST_NORMALIZATION_TYPES_OK_EXAMPLE);
  });

  it('GET /api/normalization-types não expõe campos internos', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/api/normalization-types')
      .expect(200);
    const body = response.body as ListBody;

    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual([
        'code',
        'description',
        'id',
        'includesBrand',
        'includesCategory',
      ]);
    }
  });

  it('o endpoint aparece no Swagger com a tag normalization-types', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/api/docs-json')
      .expect(200);
    const document = response.body as {
      paths: Record<string, { get?: { tags?: string[] } }>;
    };

    expect(document.paths['/api/normalization-types']?.get?.tags).toEqual([
      'normalization-types',
    ]);
  });
});
