/**
 * Mapeo entre tipos locales y códigos SUNAT (catálogos oficiales).
 * Centraliza la conversión para el cliente Mifact y validaciones de respuesta.
 *
 * IMPORTANTE: estos string union types deben mantenerse en sincronía con los
 * enums definidos en backend/prisma/schema.prisma. No importar desde
 * @prisma/client porque el cliente generado puede no incluir los enums nuevos
 * hasta que se ejecute `prisma migrate dev` / `prisma generate`.
 */

// ─── String union types locales (espejo de los enums Prisma) ─────────────────

export type TipoCpe =
  | 'factura'
  | 'boleta'
  | 'nota_credito'
  | 'nota_debito'
  | 'guia_remitente'
  | 'guia_transportista';

export type TipoAfectacionIgv =
  | 'gravado_onerosa'
  | 'gravado_retiro_premio'
  | 'gravado_retiro_donacion'
  | 'gravado_retiro'
  | 'gravado_retiro_publicidad'
  | 'gravado_bonificaciones'
  | 'gravado_retiro_trabajadores'
  | 'gravado_ivap'
  | 'exonerado_onerosa'
  | 'exonerado_transferencia_gratuita'
  | 'inafecto_onerosa'
  | 'inafecto_retiro_bonificacion'
  | 'inafecto_retiro'
  | 'inafecto_retiro_muestras'
  | 'inafecto_retiro_convenio'
  | 'inafecto_retiro_premio'
  | 'inafecto_retiro_publicidad'
  | 'inafecto_transf_gratuita_no_grav'
  | 'exportacion';

export type TipoNotaCredito =
  | 'anulacion_operacion'
  | 'anulacion_error_ruc'
  | 'correccion_descripcion'
  | 'descuento_global'
  | 'descuento_item'
  | 'devolucion_total'
  | 'devolucion_item'
  | 'bonificacion'
  | 'disminucion_valor'
  | 'otros_conceptos'
  | 'ajustes_exportacion'
  | 'ajustes_montos_fechas_pago'
  | 'ajustes_intereses_penalidades';

export type TipoDocumento =
  | 'dni'
  | 'carne_extranjeria'
  | 'ruc'
  | 'pasaporte'
  | 'otro';

export type EstadoSunat =
  | 'pendiente'
  | 'en_proceso'
  | 'aceptado'
  | 'aceptado_observado'
  | 'rechazado'
  | 'anulado'
  | 'baja_pendiente';

// ─── Catálogos SUNAT ──────────────────────────────────────────────────────────

// Catálogo SUNAT 01 — Tipo de comprobante
export const CODIGO_TIPO_CPE: Record<TipoCpe, string> = {
  factura: '01',
  boleta: '03',
  nota_credito: '07',
  nota_debito: '08',
  guia_remitente: '09',
  guia_transportista: '31',
};

// Catálogo SUNAT 07 — Tipo de afectación del IGV
export const CODIGO_TIPO_AFECTACION_IGV: Record<TipoAfectacionIgv, string> = {
  gravado_onerosa: '10',
  gravado_retiro_premio: '11',
  gravado_retiro_donacion: '12',
  gravado_retiro: '13',
  gravado_retiro_publicidad: '14',
  gravado_bonificaciones: '15',
  gravado_retiro_trabajadores: '16',
  gravado_ivap: '17',
  exonerado_onerosa: '20',
  exonerado_transferencia_gratuita: '21',
  inafecto_onerosa: '30',
  inafecto_retiro_bonificacion: '31',
  inafecto_retiro: '32',
  inafecto_retiro_muestras: '33',
  inafecto_retiro_convenio: '34',
  inafecto_retiro_premio: '35',
  inafecto_retiro_publicidad: '36',
  inafecto_transf_gratuita_no_grav: '37',
  exportacion: '40',
};

// Catálogo SUNAT 09 — Tipo de nota de crédito
export const CODIGO_TIPO_NOTA_CREDITO: Record<TipoNotaCredito, string> = {
  anulacion_operacion: '01',
  anulacion_error_ruc: '02',
  correccion_descripcion: '03',
  descuento_global: '04',
  descuento_item: '05',
  devolucion_total: '06',
  devolucion_item: '07',
  bonificacion: '08',
  disminucion_valor: '09',
  otros_conceptos: '10',
  ajustes_exportacion: '11',
  ajustes_montos_fechas_pago: '12',
  ajustes_intereses_penalidades: '13',
};

// Catálogo SUNAT 06 — Tipo de documento de identidad
export const CODIGO_TIPO_DOC_IDENTIDAD: Record<TipoDocumento, string> = {
  dni: '1',
  carne_extranjeria: '4',
  ruc: '6',
  pasaporte: '7',
  otro: '0',
};

// ─── Reglas SUNAT — identificación del adquiriente en boletas ────────────────

/**
 * Umbral (S/) por encima del cual una BOLETA debe identificar al adquiriente con
 * su documento (DNI u otro). Reglamento de Comprobantes de Pago: las boletas
 * cuyo importe total supere S/ 700 deben consignar los datos de identificación
 * del adquiriente. Por debajo se admite "consumidor final".
 */
export const UMBRAL_IDENTIFICACION_BOLETA = 700;

/**
 * Número de documento genérico para boleta a "consumidor final" (cliente sin DNI).
 * Convención documentada por Mifact: COD_TIP_NIF_RECP='0' + NUM_NIF_RECP='00000000'.
 */
export const NUM_DOC_CONSUMIDOR_FINAL = '00000000';

/**
 * ¿El número de documento identifica realmente al adquiriente? Es decir, NO es el
 * placeholder de consumidor final ('00000000') ni está vacío.
 */
export function documentoIdentificaAdquiriente(
  numeroDocumento: string | null | undefined,
): boolean {
  const n = (numeroDocumento ?? '').trim();
  return n.length > 0 && n !== NUM_DOC_CONSUMIDOR_FINAL;
}

/** ¿Una boleta de este importe total exige identificar al adquiriente con su documento? */
export function boletaRequiereIdentificacion(totalVenta: number): boolean {
  return Number.isFinite(totalVenta) && totalVenta > UMBRAL_IDENTIFICACION_BOLETA;
}

// Códigos de estado que devuelve Mifact tras consulta a SUNAT
export const CODIGO_A_ESTADO_SUNAT: Record<string, EstadoSunat> = {
  '101': 'en_proceso',
  '102': 'aceptado',
  '103': 'aceptado_observado',
  '104': 'rechazado',
  '105': 'anulado',
  '108': 'baja_pendiente',
};

function reverso<T extends string>(mapa: Record<T, string>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(mapa).map(([k, v]) => [v as string, k as T]),
  ) as Record<string, T>;
}

export const TIPO_CPE_DESDE_CODIGO = reverso(CODIGO_TIPO_CPE);
export const TIPO_AFECTACION_IGV_DESDE_CODIGO = reverso(CODIGO_TIPO_AFECTACION_IGV);
export const TIPO_NOTA_CREDITO_DESDE_CODIGO = reverso(CODIGO_TIPO_NOTA_CREDITO);
export const TIPO_DOC_IDENTIDAD_DESDE_CODIGO = reverso(CODIGO_TIPO_DOC_IDENTIDAD);
