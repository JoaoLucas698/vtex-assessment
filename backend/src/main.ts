import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { AppModule } from '@/app.module';
import { configureApp } from '@shared/config/configure-app';

// O Prisma 7 não carrega o `.env` sozinho. No Docker as variáveis vêm do ambiente.
if (existsSync('.env')) process.loadEnvFile('.env');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
