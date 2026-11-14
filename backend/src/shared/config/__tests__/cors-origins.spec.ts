import { parseCorsOrigins } from '@shared/config/cors-origins';

describe('parseCorsOrigins', () => {
  it('devolve lista vazia quando a variável não existe', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  it('devolve lista vazia quando a variável está vazia ou só tem espaços e vírgulas', () => {
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins(' , ,')).toEqual([]);
  });

  it('separa por vírgula e remove espaços nas pontas', () => {
    expect(
      parseCorsOrigins(' http://localhost:5173 ,http://127.0.0.1:5173 '),
    ).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
  });

  it('aceita uma única origem', () => {
    expect(parseCorsOrigins('https://app.exemplo.com')).toEqual([
      'https://app.exemplo.com',
    ]);
  });
});
