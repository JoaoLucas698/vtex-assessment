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
    it('monta a chave no formato <marca>|<nome>', () => {
      expect(sut.buildKey('Samsung', 'Smartphone Galaxy S23')).toBe(
        'samsung|smartphone galaxy s23',
      );
    });

    it('une as variações reais do arquivo de carga', () => {
      expect(sut.buildKey('Apple', 'iPhone 15  Pro')).toBe(
        sut.buildKey('Apple', 'iPhone 15 Pro'),
      );
      expect(sut.buildKey('Canon', 'Câmera Canon EOS R6')).toBe(
        sut.buildKey('Canon', 'Camera Canon EOS R6'),
      );
      expect(sut.buildKey('Apple', 'iPad Pro 12.9"')).toBe(
        sut.buildKey('APPLE', "iPad Pro 12.9''"),
      );
      expect(sut.buildKey(' Apple ', 'iPad Pro 12.9')).toBe(
        sut.buildKey('Apple', 'iPad Pro 12.9"'),
      );
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['vazia', ''],
      ['só espaços', '  '],
    ])('usa |<nome> quando a marca é %s', (_label, brand) => {
      expect(sut.buildKey(brand, 'Cable Organizer Kit')).toBe(
        '|cable organizer kit',
      );
    });

    it('marca vazia não colide com marca preenchida', () => {
      expect(sut.buildKey(null, 'Organizer Kit')).not.toBe(
        sut.buildKey('Organizer', 'Kit'),
      );
      expect(sut.buildKey(null, 'Organizer Kit')).toBe('|organizer kit');
      expect(sut.buildKey('Organizer', 'Kit')).toBe('organizer|kit');
    });

    it('categoria não entra na chave (buildKey só recebe marca e nome)', () => {
      // Photography × Photo para o mesmo produto: a chave é a mesma porque a
      // categoria nem é argumento.
      expect(sut.buildKey.length).toBe(2);
      expect(sut.buildKey('Canon', 'Camera Canon EOS R6')).toBe(
        'canon|camera canon eos r6',
      );
    });

    it("usa levis na chave de Levi's (o dado original não muda)", () => {
      const brand = "Levi's";

      expect(sut.buildKey(brand, 'Jeans 501')).toBe('levis|jeans 501');
      expect(brand).toBe("Levi's");
    });

    it('gera chave determinística para marca com tentativa de SQL injection', () => {
      const key = sut.buildKey("TestBrand'; SELECT 1; --", 'Test Product');

      expect(key).toBe('testbrand; select 1; --|test product');
      expect(sut.buildKey("TestBrand'; SELECT 1; --", 'Test Product')).toBe(
        key,
      );
    });

    it('não une produtos diferentes com nomes parecidos', () => {
      expect(sut.buildKey('Dyson', 'Vacuum Cleaner Upright')).not.toBe(
        sut.buildKey('Dyson', 'Vacuum Cleaner Cordless'),
      );
    });

    it('não une marcas diferentes com o mesmo nome', () => {
      expect(sut.buildKey('Samsung', 'Smart TV 55"')).not.toBe(
        sut.buildKey('LG', 'Smart TV 55"'),
      );
    });

    it('limitação conhecida (D-016): traduções NÃO são unidas pela chave', () => {
      // São o mesmo produto, mas a regra aceita criar dois produtos em vez de
      // arriscar unir produtos diferentes. Ver docs/decisions.md D-016.
      expect(sut.buildKey('TP-Link', 'Roteador WiFi 6 TP-Link')).not.toBe(
        sut.buildKey('TP-Link', 'Router WiFi 6 TP-Link'),
      );
      expect(sut.buildKey('AMD', 'Processador AMD Ryzen 9 7950X')).not.toBe(
        sut.buildKey('AMD', 'Processor AMD Ryzen 9 7950X'),
      );
    });
  });
});
