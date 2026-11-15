import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { configureApp } from '@shared/config/configure-app';
import { createTempDirectory } from '@test/helpers/temp-directory';

const ALLOWED_ORIGIN = 'http://localhost:5173';
const OTHER_ORIGIN = 'http://evil.example.com';

async function createApp(
  corsOrigins: string | undefined,
): Promise<INestApplication> {
  process.env.DATABASE_URL = `file:${join(createTempDirectory('cors-'), 'catalog.db').replaceAll('\\', '/')}`;
  if (corsOrigins === undefined) delete process.env.CORS_ORIGINS;
  else process.env.CORS_ORIGINS = corsOrigins;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('CORS a partir de CORS_ORIGINS', () => {
  const originalValue = process.env.CORS_ORIGINS;
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    if (originalValue === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalValue;
  });

  it('libera a origem listada na variável', async () => {
    app = await createApp(`${ALLOWED_ORIGIN}, http://127.0.0.1:5173`);

    const response = await request(app.getHttpServer() as App)
      .get('/api/docs-json')
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(
      ALLOWED_ORIGIN,
    );
  });

  it('não libera origem fora da lista', async () => {
    app = await createApp(ALLOWED_ORIGIN);

    const response = await request(app.getHttpServer() as App)
      .get('/api/docs-json')
      .set('Origin', OTHER_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('deixa o CORS desligado quando a variável não existe', async () => {
    app = await createApp(undefined);

    const response = await request(app.getHttpServer() as App)
      .get('/api/docs-json')
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
