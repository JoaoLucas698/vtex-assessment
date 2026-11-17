import type { NormalizationRule } from '@modules/catalog-import/schemas/catalog-import.types';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';

describe('ProductNormalizerService', () => {
  let sut: ProductNormalizerService;

  beforeEach(() => {
    sut = new ProductNormalizerService();
  });

  describe('normalize', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['texto vazio', ''],
      ['só espaços', '   '],
    ])('devolve string vazia para %s', (_label, input) => {
      expect(sut.normalize(input)).toBe('');
    });

    it('junta espaços duplos', () => {
      expect(sut.normalize('iPhone 15  Pro')).toBe(
        sut.normalize('iPhone 15 Pro'),
      );
      expect(sut.normalize('iPhone 15  Pro')).toBe('iphone 15 pro');
    });

    it('troca tabs e quebras de linha por um espaço e faz trim', () => {
      expect(sut.normalize('\t  Smartphone\tGalaxy \n S23  \t')).toBe(
        'smartphone galaxy s23',
      );
    });

    it('remove acentos', () => {
      expect(sut.normalize('Câmera Canon EOS R6')).toBe(
        sut.normalize('Camera Canon EOS R6'),
      );
      expect(sut.normalize('Câmera Canon EOS R6')).toBe('camera canon eos r6');
      expect(sut.normalize('ÁÉÍÓÚ àèìòù ÂÊÔ ãõ ç Ç ñ ü')).toBe(
        'aeiou aeiou aeo ao c c n u',
      );
    });

    it('remove acentos também quando o texto vem decomposto (NFD)', () => {
      expect(sut.normalize('Câmera')).toBe('camera');
    });

    it('converte para minúsculas', () => {
      expect(sut.normalize('SMARTPHONE Galaxy s23')).toBe(
        'smartphone galaxy s23',
      );
    });

    it("trata aspas de polegada: 12.9\", 12.9'' e 12.9 ficam iguais", () => {
      const withDoubleQuote = sut.normalize('iPad Pro 12.9"');
      const withTwoSingleQuotes = sut.normalize("iPad Pro 12.9''");
      const withoutQuotes = sut.normalize('iPad Pro 12.9');

      expect(withDoubleQuote).toBe('ipad pro 12.9');
      expect(withTwoSingleQuotes).toBe(withDoubleQuote);
      expect(withoutQuotes).toBe(withDoubleQuote);
    });

    it('trata aspas de polegada: 55" e 55 ficam iguais', () => {
      expect(sut.normalize('Smart TV 55"')).toBe(sut.normalize('Smart TV 55'));
    });

    it('remove aspas antes de juntar espaços (aspa isolada não deixa espaço duplo)', () => {
      expect(sut.normalize('TV 55 " LED')).toBe('tv 55 led');
    });

    it("remove a aspa de Levi's só no texto normalizado, sem alterar o original", () => {
      const original = "Levi's";

      expect(sut.normalize(original)).toBe('levis');
      expect(original).toBe("Levi's");
    });

    it('gera texto determinístico, sem erro, para tentativa de SQL injection', () => {
      const brand = "TestBrand'; SELECT 1; --";

      expect(sut.normalize(brand)).toBe('testbrand; select 1; --');
      expect(sut.normalize(brand)).toBe(sut.normalize(brand));
    });

    it('é idempotente', () => {
      const once = sut.normalize('  Câmera  Canon 12.9"  ');
      expect(sut.normalize(once)).toBe(once);
    });
  });

  describe('buildKey', () => {
    const NAME_BRAND: NormalizationRule = {
      includesBrand: true,
      includesCategory: false,
    };
    const NAME_CATEGORY: NormalizationRule = {
      includesBrand: false,
      includesCategory: true,
    };
    const NAME_BRAND_CATEGORY: NormalizationRule = {
      includesBrand: true,
      includesCategory: true,
    };

    /** Atalho para a regra NAME_BRAND (formato legado `<marca>|<nome>`). */
    const brandKey = (brand: string | null | undefined, name: string): string =>
      sut.buildKey({ name, brand, category: null }, NAME_BRAND);

    describe('regras', () => {
      const fields = {
        name: 'Câmera  Canon EOS R6',
        brand: 'Canon',
        category: 'Fotografia',
      };

      it('NAME_BRAND monta <marca>|<nome>', () => {
        expect(sut.buildKey(fields, NAME_BRAND)).toBe(
          'canon|camera canon eos r6',
        );
      });

      it('NAME_CATEGORY monta <categoria>|<nome>', () => {
        expect(sut.buildKey(fields, NAME_CATEGORY)).toBe(
          'fotografia|camera canon eos r6',
        );
      });

      it('NAME_BRAND_CATEGORY monta <marca>|<categoria>|<nome>', () => {
        expect(sut.buildKey(fields, NAME_BRAND_CATEGORY)).toBe(
          'canon|fotografia|camera canon eos r6',
        );
      });

      it('NAME_BRAND ignora a categoria (Photography × Photo dão a mesma chave)', () => {
        expect(
          sut.buildKey({ ...fields, category: 'Photography' }, NAME_BRAND),
        ).toBe(sut.buildKey({ ...fields, category: 'Photo' }, NAME_BRAND));
      });

      it('NAME_CATEGORY ignora a marca', () => {
        expect(sut.buildKey({ ...fields, brand: 'Outra' }, NAME_CATEGORY)).toBe(
          sut.buildKey(fields, NAME_CATEGORY),
        );
      });

      it('NAME_BRAND gera exatamente o formato antigo `${normalize(marca)}|${normalize(nome)}`', () => {
        const samples: [string | null, string][] = [
          ['Samsung', 'Smartphone Galaxy S23'],
          [null, 'Cable Organizer Kit'],
          ["Levi's", ' Jeans  501 '],
          ['  ', 'Só espaços'],
          ['Ação', 'Câmera 12.9"'],
        ];
        for (const [brand, name] of samples) {
          expect(
            sut.buildKey({ name, brand, category: 'Qualquer' }, NAME_BRAND),
          ).toBe(`${sut.normalize(brand)}|${sut.normalize(name)}`);
        }
      });
    });

    describe('marca e categoria vazias', () => {
      it.each([
        ['null', null],
        ['undefined', undefined],
        ['vazia', ''],
        ['só espaços', '  '],
      ])('marca %s vira parte vazia: |<nome>', (_label, brand) => {
        expect(brandKey(brand, 'Cable Organizer Kit')).toBe(
          '|cable organizer kit',
        );
      });

      it.each([
        ['null', null],
        ['undefined', undefined],
        ['vazia', ''],
        ['só espaços', '  '],
      ])('categoria %s vira parte vazia: |<nome>', (_label, category) => {
        expect(
          sut.buildKey(
            { name: 'Cable Organizer Kit', brand: 'Acme', category },
            NAME_CATEGORY,
          ),
        ).toBe('|cable organizer kit');
      });

      it('NAME_BRAND_CATEGORY mantém as três partes mesmo com marca e categoria vazias', () => {
        expect(
          sut.buildKey(
            { name: 'Cable Organizer Kit', brand: null, category: null },
            NAME_BRAND_CATEGORY,
          ),
        ).toBe('||cable organizer kit');
        expect(
          sut.buildKey(
            { name: 'Kit', brand: null, category: 'Casa' },
            NAME_BRAND_CATEGORY,
          ),
        ).toBe('|casa|kit');
        expect(
          sut.buildKey(
            { name: 'Kit', brand: 'Acme', category: null },
            NAME_BRAND_CATEGORY,
          ),
        ).toBe('acme||kit');
      });
    });

    describe('separadores evitam colisões', () => {
      it('marca vazia não colide com marca preenchida', () => {
        expect(brandKey(null, 'Organizer Kit')).not.toBe(
          brandKey('Organizer', 'Kit'),
        );
        expect(brandKey(null, 'Organizer Kit')).toBe('|organizer kit');
        expect(brandKey('Organizer', 'Kit')).toBe('organizer|kit');
      });

      it('categoria vazia não colide com categoria preenchida', () => {
        const empty = sut.buildKey(
          { name: 'Garden Kit', brand: null, category: null },
          NAME_CATEGORY,
        );
        const filled = sut.buildKey(
          { name: 'Kit', brand: null, category: 'Garden' },
          NAME_CATEGORY,
        );
        expect(empty).not.toBe(filled);
      });

      it('NAME_BRAND_CATEGORY: marca e categoria trocadas de lugar não colidem', () => {
        expect(
          sut.buildKey(
            { name: 'Kit', brand: 'Casa', category: null },
            NAME_BRAND_CATEGORY,
          ),
        ).not.toBe(
          sut.buildKey(
            { name: 'Kit', brand: null, category: 'Casa' },
            NAME_BRAND_CATEGORY,
          ),
        );
      });
    });

    it('une as variações reais do arquivo de carga', () => {
      expect(brandKey('Apple', 'iPhone 15  Pro')).toBe(
        brandKey('Apple', 'iPhone 15 Pro'),
      );
      expect(brandKey('Canon', 'Câmera Canon EOS R6')).toBe(
        brandKey('Canon', 'Camera Canon EOS R6'),
      );
      expect(brandKey('Apple', 'iPad Pro 12.9"')).toBe(
        brandKey('APPLE', "iPad Pro 12.9''"),
      );
      expect(brandKey(' Apple ', 'iPad Pro 12.9')).toBe(
        brandKey('Apple', 'iPad Pro 12.9"'),
      );
    });

    it("usa levis na chave de Levi's (o dado original não muda)", () => {
      const brand = "Levi's";

      expect(brandKey(brand, 'Jeans 501')).toBe('levis|jeans 501');
      expect(brand).toBe("Levi's");
    });

    it('gera chave determinística para marca com tentativa de SQL injection', () => {
      const key = brandKey("TestBrand'; SELECT 1; --", 'Test Product');

      expect(key).toBe('testbrand; select 1; --|test product');
      expect(brandKey("TestBrand'; SELECT 1; --", 'Test Product')).toBe(key);
    });

    it('gera chave determinística para categoria com tentativa de SQL injection', () => {
      const fields = {
        name: 'Test Product',
        brand: null,
        category: "x'; SELECT 1; --",
      };

      expect(sut.buildKey(fields, NAME_CATEGORY)).toBe(
        'x; select 1; --|test product',
      );
      expect(fields.category).toBe("x'; SELECT 1; --");
    });

    it('não une produtos diferentes com nomes parecidos', () => {
      expect(brandKey('Dyson', 'Vacuum Cleaner Upright')).not.toBe(
        brandKey('Dyson', 'Vacuum Cleaner Cordless'),
      );
    });

    it('não une marcas diferentes com o mesmo nome', () => {
      expect(brandKey('Samsung', 'Smart TV 55"')).not.toBe(
        brandKey('LG', 'Smart TV 55"'),
      );
    });

    it('limitação conhecida (D-016): traduções NÃO são unidas pela chave', () => {
      // São o mesmo produto, mas a regra aceita criar dois produtos em vez de
      // arriscar unir produtos diferentes. Ver docs/decisions.md D-016.
      expect(brandKey('TP-Link', 'Roteador WiFi 6 TP-Link')).not.toBe(
        brandKey('TP-Link', 'Router WiFi 6 TP-Link'),
      );
      expect(brandKey('AMD', 'Processador AMD Ryzen 9 7950X')).not.toBe(
        brandKey('AMD', 'Processor AMD Ryzen 9 7950X'),
      );
    });
  });
});
