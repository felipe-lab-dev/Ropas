/**
 * Catálogo SUNAT 03 — Unidades de Medida.
 *
 * El catálogo oficial SUNAT tiene ~400 entradas pero retail/ropa usa ~10.
 * Para añadir una unidad: agregá la entrada acá, redesplegá.
 *
 * Si en el futuro un tenant quiere ocultar unidades de su UI (ej. "yo no
 * vendo nada por KGM"), eso es config per-tenant — vive en Tenant.configCache
 * (Json), no acá.
 */

export interface UnidadMedidaSunat {
  codigo: string;
  nombre: string;
  simbolo: string;
}

export const UNIDADES_MEDIDA: readonly UnidadMedidaSunat[] = [
  { codigo: 'NIU', nombre: 'Unidad (bienes)', simbolo: 'u' },
  { codigo: 'ZZ', nombre: 'Servicios', simbolo: 'srv' },
  { codigo: 'PAR', nombre: 'Par', simbolo: 'par' },
  { codigo: 'KGM', nombre: 'Kilogramo', simbolo: 'kg' },
  { codigo: 'GRM', nombre: 'Gramo', simbolo: 'g' },
  { codigo: 'MTR', nombre: 'Metro', simbolo: 'm' },
  { codigo: 'MTK', nombre: 'Metro cuadrado', simbolo: 'm²' },
  { codigo: 'LTR', nombre: 'Litro', simbolo: 'L' },
];

const indicePorCodigo = new Map(UNIDADES_MEDIDA.map((u) => [u.codigo, u]));

export function listarUnidadesMedida(): readonly UnidadMedidaSunat[] {
  return UNIDADES_MEDIDA;
}

export function obtenerUnidadMedida(codigo: string): UnidadMedidaSunat | undefined {
  return indicePorCodigo.get(codigo);
}

export function unidadMedidaExiste(codigo: string): boolean {
  return indicePorCodigo.has(codigo);
}
