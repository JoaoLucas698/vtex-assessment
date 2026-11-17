import { PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '@shared/prisma/create-prisma-adapter';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, readdirSync, readFileSync } from 'node:fs';
import {
  createTempDirectory,
  removeTempDirectory,
} from '@test/helpers/temp-directory';
import { join, resolve } from 'node:path';

const BACKEND_ROOT = resolve(__dirname, '..', '..');
const PRISMA_CLI = join(
  BACKEND_ROOT,
  'node_modules',
  'prisma',
  'build',
  'index.js',
);
const BASELINE_MIGRATION = '0_init';
const MIGRATIONS_DIRECTORY = join(BACKEND_ROOT, 'prisma', 'migrations');

/** Banco fornecido, nunca alterado: os testes sempre trabalham numa cópia. */
export const ORIGINAL_DATABASE_PATH = resolve(
  BACKEND_ROOT,
  '..',
  'database',
  'catalog.db',
);

export function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export interface LegacyProductInput {
  name: string;
  brand: string | null;
  category: string | null;
}

/**
 * Cópia temporária de `database/catalog.db` (formato original, antes da migration de
 * consolidação). Permite gravar dados legados, rodar `prisma migrate deploy` e conferir o
 * resultado com o Prisma Client.
 */
export class LegacyDatabase {
  private prisma: PrismaClient | null = null;

  private constructor(
    private readonly directory: string,
    readonly path: string,
  ) {}

  static create(): LegacyDatabase {
    const directory = createTempDirectory('catalog-migration-');
    const path = join(directory, 'catalog.test.db');
    copyFileSync(ORIGINAL_DATABASE_PATH, path);
    return new LegacyDatabase(directory, path);
  }

  get url(): string {
    return `file:${this.path.replaceAll('\\', '/')}`;
  }

  client(): PrismaClient {
    this.prisma ??= new PrismaClient({
      adapter: createPrismaAdapter(this.url),
    });
    return this.prisma;
  }

  async disconnect(): Promise<void> {
    await this.prisma?.$disconnect();
    this.prisma = null;
  }

  /**
   * O banco fornecido não tem a tabela `_prisma_migrations`: primeiro marca a baseline
   * (`0_init`) como aplicada, depois aplica as migrations seguintes com `migrate deploy`.
   */
  async migrate(): Promise<void> {
    await this.disconnect();
    this.runPrisma(['migrate', 'resolve', '--applied', BASELINE_MIGRATION]);
    this.runPrisma(['migrate', 'deploy']);
  }

  /**
   * Aplica as migrations só até `lastMigration` (inclusive), para o teste conferir o banco
   * antes das migrations seguintes. Cada uma roda com `prisma db execute` e é registrada com
   * `migrate resolve --applied`; depois, `deployPending()` aplica o resto com `migrate deploy`.
   */
  async migrateUpTo(lastMigration: string): Promise<void> {
    await this.disconnect();
    this.runPrisma(['migrate', 'resolve', '--applied', BASELINE_MIGRATION]);
    const names = readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== BASELINE_MIGRATION)
      .sort();
    if (!names.includes(lastMigration)) {
      throw new Error(`Migration ${lastMigration} não encontrada.`);
    }
    for (const name of names.filter((n) => n <= lastMigration)) {
      const file = join(MIGRATIONS_DIRECTORY, name, 'migration.sql');
      this.runPrisma(['db', 'execute', '--file', file]);
      this.runPrisma(['migrate', 'resolve', '--applied', name]);
    }
  }

  /** Aplica as migrations ainda pendentes (`migrate deploy`). */
  async deployPending(): Promise<void> {
    await this.disconnect();
    this.runPrisma(['migrate', 'deploy']);
  }

  async cleanup(): Promise<void> {
    await this.disconnect();
    removeTempDirectory(this.directory);
  }

  private runPrisma(args: string[]): void {
    execFileSync(process.execPath, [PRISMA_CLI, ...args], {
      cwd: BACKEND_ROOT,
      env: { ...process.env, DATABASE_URL: this.url },
      encoding: 'utf8',
      stdio: 'pipe',
    });
  }
}

/**
 * Grava um produto no formato legado (`Product(Id, Name, Brand, Category)`) e devolve o id.
 *
 * SQL manual com template literal (valores parametrizados): o Prisma Client gerado conhece
 * só o modelo final, então não consegue gravar nas tabelas do formato original (D-055).
 */
export async function insertLegacyProduct(
  prisma: PrismaClient,
  product: LegacyProductInput,
): Promise<number> {
  await prisma.$executeRaw`INSERT INTO "Product" ("Name", "Brand", "Category") VALUES (${product.name}, ${product.brand}, ${product.category})`;
  const rows = await prisma.$queryRaw<
    { id: bigint }[]
  >`SELECT MAX("Id") AS id FROM "Product"`;
  return Number(rows[0].id);
}

/** Grava vários produtos legados de uma vez (mesma justificativa de `insertLegacyProduct`). */
export async function insertLegacyProducts(
  prisma: PrismaClient,
  products: LegacyProductInput[],
): Promise<void> {
  await prisma.$transaction(
    products.map(
      (product) =>
        prisma.$executeRaw`INSERT INTO "Product" ("Name", "Brand", "Category") VALUES (${product.name}, ${product.brand}, ${product.category})`,
    ),
  );
}

/** Grava um vínculo no formato legado (`SellerProduct(Id, SellerName, ProductId, SellerProductId)`). */
export async function insertLegacyLink(
  prisma: PrismaClient,
  link: { sellerName: string; productId: number; sellerProductId: number },
): Promise<void> {
  await prisma.$executeRaw`INSERT INTO "SellerProduct" ("SellerName", "ProductId", "SellerProductId") VALUES (${link.sellerName}, ${link.productId}, ${link.sellerProductId})`;
}
