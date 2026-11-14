import { PrismaLibSql } from '@prisma/adapter-libsql';

/**
 * Driver adapter do SQLite exigido pelo Prisma 7 (D-110).
 * O caminho de `file:` relativo é resolvido a partir do diretório de trabalho (`backend/`).
 */
export function createPrismaAdapter(url: string): PrismaLibSql {
  return new PrismaLibSql({ url });
}
