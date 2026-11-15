import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import {
  insertLegacyProducts,
  LegacyDatabase,
  LegacyProductInput,
} from '@test/helpers/legacy-database';

const REAL_PRODUCTS = 975;
const LATIN_1_SUPPLEMENT_START = 0xc0;
const LATIN_EXTENDED_A_END = 0x17f;

function hex(codePoint: number): string {
  return codePoint.toString(16).toUpperCase().padStart(4, '0');
}

/** Um produto para cada letra de Latin-1 Supplement e Latin Extended-A, na marca e no nome. */
function buildLetterCases(): LegacyProductInput[] {
  const cases: LegacyProductInput[] = [];
  for (
    let codePoint = LATIN_1_SUPPLEMENT_START;
    codePoint <= LATIN_EXTENDED_A_END;
    codePoint++
  ) {
    const letter = String.fromCodePoint(codePoint);
    cases.push({
      name: `Letra U+${hex(codePoint)} ${letter}${letter.toLowerCase()}x`,
      brand: `Marca${letter}`,
      category: null,
    });
  }
  return cases;
}

/** Espaços em branco, aspas e combinações que a normalização precisa tratar igual. */
function buildFormattingCases(): LegacyProductInput[] {
  const cases: [string | null, string][] = [
    ['Acme', 'Tela 12.9"'],
    ['Acme', "Tela 12.9''"],
    ['Acme', "  Tela   12.9'' Pro  "],
    ["Levi's", "Jeans Levi's 501"],
    [null, "'''"],
    ['"', 'Só aspas "" e \'\' no meio'],
    ['  ', 'Marca só com espaços'],
    ['', 'Marca vazia'],
    [null, 'Marca nula'],
    ['TAB', 'Com\ttab\tno meio'],
    ['LF', 'Com\nquebra\nde linha'],
    ['CR', 'Com\rretorno\rde carro'],
    ['CRLF', 'Com\r\nCRLF'],
    ['VT FF', 'Com\vvt\fff'],
    ['NBSP', 'Com\u00a0nbsp\u00a0\u00a0aqui'],
    ['EM', 'Com\u2003em\u2002space'],
    ['IDEO', 'Com\u3000ideografico'],
    ['BOM', 'Com\ufeffbom'],
    ['LSEP', 'Com\u2028separador\u2029paragrafo'],
    ['NNBSP', 'Com\u202fnnbsp\u205fmmsp\u1680ogham'],
    ['LONGO', `Muitos${' '.repeat(40)}espacos`],
    ['Acentos', '  ÀÉÎÕÜ àéîõü Ç ç Ñ ñ  '],
    ['ACENTOS', 'ÁÂÃÄÅ ÈÊË ÌÏ ÒÔÖ ÙÚÛ ÝŸ ÿý'],
    ['Latin A', 'Ő ő Ű ű Ŕ ŕ Ž ž Š š Č č Ě ě Ř ř Ů ů'],
    ['Sem decomposicao', 'Øre Ææ ß Đđ Łł Œœ Þþ Ðð Ħħ Ŧŧ Ŋŋ'],
    ['Decomposto', 'Cafe\u0301 A\u0303 n\u0303 U\u0308 c\u0327 \u00e9'],
    ['Misto', "Câmera  CANON 12.9'' « raro »"],
  ];
  return cases.map(([brand, name], index) => ({
    name: `${name} #${index}`,
    brand,
    category: null,
  }));
}

describe('Consistência do normalizedKey: SQL da migration × ProductNormalizerService', () => {
  let database: LegacyDatabase;
  const normalizer = new ProductNormalizerService();
  const synthetic = [...buildLetterCases(), ...buildFormattingCases()];

  beforeAll(async () => {
    database = LegacyDatabase.create();
    await insertLegacyProducts(database.client(), synthetic);
    await database.migrate();
  }, 120_000);

  afterAll(async () => {
    await database.cleanup();
  });

  it('a chave gravada pela migration é igual à calculada em TypeScript em todos os produtos', async () => {
    const prisma = database.client();

    const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
    const divergences = products
      .map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        sql: p.normalizedKey,
        ts: normalizer.buildKey(p.brand, p.name),
      }))
      .filter((p) => p.sql !== p.ts);

    expect(products.length).toBe(REAL_PRODUCTS + synthetic.length);
    expect(divergences).toEqual([]);
  });

  it('cobre todos os 975 produtos do banco fornecido', async () => {
    const prisma = database.client();

    const real = await prisma.product.findMany({
      where: { id: { lte: REAL_PRODUCTS } },
    });

    expect(real).toHaveLength(REAL_PRODUCTS);
    for (const product of real) {
      expect(product.normalizedKey).toBe(
        normalizer.buildKey(product.brand, product.name),
      );
    }
  });

  it('as chaves sintéticas são todas diferentes, então nenhuma foi unida por engano', async () => {
    const prisma = database.client();

    const keys = await prisma.product.findMany({
      select: { normalizedKey: true },
    });

    expect(new Set(keys.map((k) => k.normalizedKey)).size).toBe(keys.length);
  });
});
