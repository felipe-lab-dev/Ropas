/**
 * Convierte un monto numérico a su representación en letras al estilo de la
 * "leyenda 1000" de SUNAT, ej: `SON: DOSCIENTOS DIECINUEVE CON 00/100 SOLES`.
 *
 * Soporta enteros hasta el orden de los millones, suficiente para montos de
 * venta minorista. La parte decimal se expresa como `NN/100`.
 */

const UNIDADES = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISÉIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
];

const VEINTI = [
  '',
  'VEINTIUNO',
  'VEINTIDÓS',
  'VEINTITRÉS',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISÉIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
];

const DECENAS = [
  '',
  '',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

/** Convierte 1..99 a letras. */
function decenasALetras(n: number): string {
  if (n <= 20) return UNIDADES[n] ?? '';
  if (n < 30) return VEINTI[n - 20] ?? '';
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? (DECENAS[d] ?? '') : `${DECENAS[d] ?? ''} Y ${UNIDADES[u] ?? ''}`;
}

/** Convierte 0..999 a letras (cadena vacía para 0). */
function grupoALetras(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c] ?? '');
  if (resto > 0) partes.push(decenasALetras(resto));
  return partes.join(' ');
}

/** Apócope para grupos que preceden a MIL / MILLONES: UNO→UN, VEINTIUNO→VEINTIÚN. */
function apocopar(s: string): string {
  if (s.endsWith('VEINTIUNO')) return `${s.slice(0, -'VEINTIUNO'.length)}VEINTIÚN`;
  if (s.endsWith('UNO')) return `${s.slice(0, -'UNO'.length)}UN`;
  return s;
}

/** Convierte un entero no negativo a letras. */
export function enteroALetras(n: number): string {
  if (n === 0) return 'CERO';

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const cientos = n % 1000;

  const partes: string[] = [];

  if (millones > 0) {
    partes.push(millones === 1 ? 'UN MILLÓN' : `${apocopar(grupoALetras(millones))} MILLONES`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${apocopar(grupoALetras(miles))} MIL`);
  }
  if (cientos > 0) {
    partes.push(grupoALetras(cientos));
  }

  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

/** Nombre de la moneda en plural para la leyenda. */
function nombreMoneda(moneda: string): string {
  return moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';
}

/**
 * Devuelve la leyenda completa, ej:
 *   `SON: DOSCIENTOS DIECINUEVE CON 00/100 SOLES`
 */
export function montoEnLetras(monto: number, moneda = 'PEN'): string {
  const entero = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - entero) * 100);
  const letras = enteroALetras(entero);
  const cc = centavos.toString().padStart(2, '0');
  return `SON: ${letras} CON ${cc}/100 ${nombreMoneda(moneda)}`;
}
