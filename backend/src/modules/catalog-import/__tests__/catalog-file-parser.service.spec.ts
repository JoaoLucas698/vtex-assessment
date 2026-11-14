import { CatalogImportErrorCode } from '@modules/catalog-import/schemas/catalog-import.errors';
import { CatalogFileParserService } from '@modules/catalog-import/services/catalog-file-parser.service';

const toBuffer = (content: unknown): Buffer =>
  Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));

describe('CatalogFileParserService', () => {
  let sut: CatalogFileParserService;

  beforeEach(() => {
    sut = new CatalogFileParserService();
  });

  it.each([
    ['JSON quebrado', '[{"Id": '],
    ['conteúdo vazio', ''],
    ['só espaços', '   '],
  ])('retorna INVALID_FILE para %s', (_, content) => {
    const result = sut.parse(toBuffer(content));

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.code).toBe(CatalogImportErrorCode.INVALID_FILE);
      expect(result.error.details).toEqual(expect.any(String));
    }
  });

  it.each([
    ['objeto', { Id: '1' }],
    ['número', 42],
    ['texto', 'itens'],
    ['null', null],
  ])('retorna INVALID_FILE quando o JSON é %s e não array', (_, content) => {
    const result = sut.parse(toBuffer(JSON.stringify(content)));

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.code).toBe(CatalogImportErrorCode.INVALID_FILE);
    }
  });

  it('retorna EMPTY_FILE para array vazio', () => {
    const result = sut.parse(toBuffer([]));

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.code).toBe(CatalogImportErrorCode.EMPTY_FILE);
    }
  });

  it('ignora o BOM do UTF-8 no início do arquivo', () => {
    const result = sut.parse(
      toBuffer(`\uFEFF[{"Id":"1","SellerName":"S","Name":"N"}]`),
    );

    expect(result.isSuccess).toBe(true);
  });

  it('separa válidos e inválidos preservando a posição e os textos originais', () => {
    const result = sut.parse(
      toBuffer([
        { Id: ' 1 ', SellerName: 'Loja', Name: 'Nome  Duplo', Extra: true },
        { Id: '', SellerName: 'Loja', Name: 'X' },
        {
          Id: '3',
          SellerName: 'Loja',
          Name: 'Y',
          Brand: "Levi's",
          Category: null,
        },
      ]),
    );

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.total).toBe(3);
    expect(result.value.valid).toEqual([
      {
        index: 0,
        externalId: ' 1 ',
        sellerName: 'Loja',
        name: 'Nome  Duplo',
        brand: null,
        category: null,
      },
      {
        index: 2,
        externalId: '3',
        sellerName: 'Loja',
        name: 'Y',
        brand: "Levi's",
        category: null,
      },
    ]);
    expect(result.value.invalid).toEqual([
      {
        index: 1,
        externalId: '',
        sellerName: 'Loja',
        name: 'X',
        reason: 'Id vazio.',
      },
    ]);
  });

  it.each([
    [{ SellerName: 'S', Name: 'N' }, 'Id ausente.'],
    [{ Id: null, SellerName: 'S', Name: 'N' }, 'Id ausente.'],
    [{ Id: '\t ', SellerName: 'S', Name: 'N' }, 'Id vazio.'],
    [{ Id: 1, SellerName: 'S', Name: 'N' }, 'Id precisa ser texto.'],
    [{ Id: '1', Name: 'N' }, 'SellerName ausente.'],
    [{ Id: '1', SellerName: 'S', Name: '' }, 'Name vazio.'],
    [{ Id: '1', SellerName: 'S', Name: ['N'] }, 'Name precisa ser texto.'],
    [
      { Id: '1', SellerName: 'S', Name: 'N', Brand: 10 },
      'Brand precisa ser texto ou null.',
    ],
    [
      { Id: '1', SellerName: 'S', Name: 'N', Category: {} },
      'Category precisa ser texto ou null.',
    ],
    [null, 'O item não é um objeto JSON.'],
    [['1', 'S', 'N'], 'O item não é um objeto JSON.'],
  ])('rejeita %j com o motivo "%s"', (item, reason) => {
    const result = sut.parse(toBuffer([item]));

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.valid).toHaveLength(0);
    expect(result.value.invalid[0].reason).toBe(reason);
  });

  it('não valida o formato do Id e aceita o texto com tentativa de SQL injection', () => {
    const result = sut.parse(
      toBuffer([
        {
          Id: 'uddd0000-x',
          SellerName: 'MegaStore',
          Name: 'N',
          Brand: "TestBrand'; SELECT 1; --",
        },
      ]),
    );

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.valid[0]).toMatchObject({
      externalId: 'uddd0000-x',
      brand: "TestBrand'; SELECT 1; --",
    });
  });
});
