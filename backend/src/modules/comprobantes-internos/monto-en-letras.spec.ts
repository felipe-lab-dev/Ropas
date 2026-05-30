import { enteroALetras, montoEnLetras } from './monto-en-letras';

describe('enteroALetras', () => {
  const casos: [number, string][] = [
    [0, 'CERO'],
    [1, 'UNO'],
    [15, 'QUINCE'],
    [21, 'VEINTIUNO'],
    [33, 'TREINTA Y TRES'],
    [100, 'CIEN'],
    [101, 'CIENTO UNO'],
    [219, 'DOSCIENTOS DIECINUEVE'],
    [500, 'QUINIENTOS'],
    [999, 'NOVECIENTOS NOVENTA Y NUEVE'],
    [1000, 'MIL'],
    [1500, 'MIL QUINIENTOS'],
    [2000, 'DOS MIL'],
    [21000, 'VEINTIÚN MIL'],
    [100000, 'CIEN MIL'],
    [1000000, 'UN MILLÓN'],
    [2500000, 'DOS MILLONES QUINIENTOS MIL'],
  ];

  it.each(casos)('convierte %i → %s', (n, esperado) => {
    expect(enteroALetras(n)).toBe(esperado);
  });
});

describe('montoEnLetras', () => {
  it('formatea la leyenda SUNAT en soles', () => {
    expect(montoEnLetras(219, 'PEN')).toBe('SON: DOSCIENTOS DIECINUEVE CON 00/100 SOLES');
  });

  it('incluye los centavos', () => {
    expect(montoEnLetras(89.9, 'PEN')).toBe('SON: OCHENTA Y NUEVE CON 90/100 SOLES');
  });

  it('usa dólares para USD', () => {
    expect(montoEnLetras(150.5, 'USD')).toBe('SON: CIENTO CINCUENTA CON 50/100 DÓLARES AMERICANOS');
  });

  it('redondea los centavos correctamente', () => {
    expect(montoEnLetras(0.1, 'PEN')).toBe('SON: CERO CON 10/100 SOLES');
  });
});
