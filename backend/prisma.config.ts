import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// O Prisma 7 não lê mais o `.env` sozinho. Sem dependência extra: usa o loader do Node.
// No Docker não existe `.env` e a variável vem do ambiente.
if (existsSync('.env')) process.loadEnvFile('.env');

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` (roda no `npm install`) não precisa de banco; os comandos
  // `migrate` falham com erro claro se a variável não estiver definida.
  ...(url ? { datasource: { url } } : {}),
});
