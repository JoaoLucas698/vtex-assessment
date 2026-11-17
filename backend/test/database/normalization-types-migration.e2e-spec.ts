import {
  LEGACY_NORMALIZATION_TYPE_ID,
  NORMALIZATION_TYPE_IDS,
} from '@modules/normalization-types/consts/normalization-types.consts';
import { NormalizationTypeCode } from '@modules/normalization-types/schemas/normalization-type.types';
import {
  hashFile,
  LegacyDatabase,
  ORIGINAL_DATABASE_PATH,
} from '@test/helpers/legacy-database';

const MIGRATION_BEFORE = '20261114041027_consolidate_catalog';

interface KeyRow {
  id: bigint | number;
  normalizedKey: string;
}

/**
 * Migration `add_normalization_types` (D-110, D-111) sobre o banco fornecido: aplica as
 * migrations até a consolidação, tira uma foto de Product e só então aplica o resto.
 */
describe('Migration add_normalization_types no banco fornecido', () => {
  let database: LegacyDatabase;
  const originalHash = hashFile(ORIGINAL_DATABASE_PATH);
  let keysBefore: { id: number; normalizedKey: string }[];
  let sequenceBefore: number;

  beforeAll(async () => {
    database = LegacyDatabase.create();
    await database.migrateUpTo(MIGRATION_BEFORE);

    // SQL manual (template literal, sem parâmetros): o Prisma Client conhece só o modelo
    // final, que ainda não existe neste ponto (D-055).
    const prisma = database.client();
    const rows = await prisma.$queryRaw<
      KeyRow[]
    >`SELECT "Id" AS "id", "NormalizedKey" AS "normalizedKey" FROM "Product" ORDER BY "Id"`;
    keysBefore = rows.map((row) => ({
      id: Number(row.id),
      normalizedKey: row.normalizedKey,
    }));
    const sequence = await prisma.$queryRaw<
      { seq: bigint | number }[]
    >`SELECT "seq" FROM "sqlite_sequence" WHERE "name" = 'Product'`;
    sequenceBefore = Number(sequence[0].seq);

    await database.deployPending();
  }, 120_000);

  afterAll(async () => {
    await database.cleanup();
  });

  it('cadastra os 3 tipos com ids, códigos e flags fixos', async () => {
    const prisma = database.client();

    const types = await prisma.normalizationType.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        code: true,
        description: true,
        includesBrand: true,
        includesCategory: true,
      },
    });

    expect(types).toEqual([
      {
        id: NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_BRAND],
        code: NormalizationTypeCode.NAME_BRAND,
        description: 'Nome + Marca',
        includesBrand: true,
        includesCategory: false,
      },
      {
        id: NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_CATEGORY],
        code: NormalizationTypeCode.NAME_CATEGORY,
        description: 'Nome + Categoria',
        includesBrand: false,
        includesCategory: true,
      },
      {
        id: NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_BRAND_CATEGORY],
        code: NormalizationTypeCode.NAME_BRAND_CATEGORY,
        description: 'Nome + Marca + Categoria',
        includesBrand: true,
        includesCategory: true,
      },
    ]);
  });

  it('todos os produtos legados ficam com o tipo NAME_BRAND', async () => {
    const prisma = database.client();

    const notLegacy = await prisma.product.count({
      where: { normalizationTypeId: { not: LEGACY_NORMALIZATION_TYPE_ID } },
    });

    expect(keysBefore.length).toBeGreaterThan(0);
    expect(notLegacy).toBe(0);
  });

  it('mantém a quantidade de produtos e cada (id, normalizedKey) idêntico', async () => {
    const prisma = database.client();

    const keysAfter = await prisma.product.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, normalizedKey: true },
    });

    expect(keysAfter).toHaveLength(keysBefore.length);
    expect(keysAfter).toEqual(keysBefore);
  });

  it('a mesma chave pode existir em tipos diferentes, mas não repetida no mesmo tipo', async () => {
    const prisma = database.client();
    const key = keysBefore[0].normalizedKey;

    const otherType = await prisma.product.create({
      data: {
        name: 'Mesma chave, outro tipo',
        normalizationTypeId:
          NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_CATEGORY],
        normalizedKey: key,
      },
    });
    const sameType = prisma.product.create({
      data: {
        name: 'Mesma chave, mesmo tipo',
        normalizationTypeId: LEGACY_NORMALIZATION_TYPE_ID,
        normalizedKey: key,
      },
    });

    expect(otherType.id).toBeGreaterThan(0);
    await expect(sameType).rejects.toMatchObject({ code: 'P2002' });
    await prisma.product.delete({ where: { id: otherType.id } });
  });

  it('não reaproveita ids: o contador de Product é preservado', async () => {
    const prisma = database.client();

    const created = await prisma.product.create({
      data: {
        name: 'Novo',
        normalizationTypeId: LEGACY_NORMALIZATION_TYPE_ID,
        normalizedKey: '|novo depois dos tipos',
      },
    });

    expect(created.id).toBeGreaterThan(sequenceBefore);
  });

  it('recusa produto com tipo inexistente (chave estrangeira)', async () => {
    const prisma = database.client();

    await expect(
      prisma.product.create({
        data: {
          name: 'Tipo inválido',
          normalizationTypeId: 999,
          normalizedKey: '|tipo invalido',
        },
      }),
    ).rejects.toBeDefined();
  });

  it('deixa a integridade das chaves estrangeiras intacta', async () => {
    const prisma = database.client();

    const violations = await prisma.$queryRaw<
      unknown[]
    >`PRAGMA foreign_key_check`;

    expect(violations).toHaveLength(0);
  });

  it('não altera o banco original', () => {
    expect(hashFile(ORIGINAL_DATABASE_PATH)).toBe(originalHash);
  });
});
