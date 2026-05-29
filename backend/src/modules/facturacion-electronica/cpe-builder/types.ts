/**
 * Tipos para el CpeBuilderService — construcción del payload JSON para Mifact.
 *
 * String union types locales espejo de los enums Prisma.
 * NO importar TipoCpe / TipoAfectacionIgv / TipoDocumento desde @prisma/client:
 * el cliente generado puede no contenerlos hasta ejecutar `prisma generate`.
 * Mantener sincronizados con backend/prisma/schema.prisma.
 */

// ─── Union types locales (espejo de enums Prisma) ─────────────────────────────

export type TipoCpeLocal =
  | 'factura'
  | 'boleta'
  | 'nota_credito'
  | 'nota_debito'
  | 'guia_remitente'
  | 'guia_transportista';

export type TipoAfectacionIgvLocal =
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

export type TipoDocumentoLocal =
  | 'dni'
  | 'carne_extranjeria'
  | 'ruc'
  | 'pasaporte'
  | 'otro';

/** Montos monetarios: acepta string o number; internamente siempre se tratan como number. */
export type DineroInput = string | number;

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface EmisorInput {
  /** RUC del emisor (11 dígitos) */
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  /** Código ubigeo SUNAT (6 dígitos) */
  ubigeo: string;
  direccionFiscal: string;
  /** Código anexo SUNAT; '0000' si es establecimiento principal */
  codigoAnexo?: string;
}

export interface ReceptorInput {
  tipoDocumento: TipoDocumentoLocal;
  numeroDocumento: string;
  razonSocial: string;
  direccion?: string;
}

export interface VentaItemInput {
  /** Código interno del producto/variante */
  codigo: string;
  /** Código unidad de medida SUNAT (ej. 'NIU') */
  unidadMedida: string;
  cantidad: DineroInput;
  /** Precio unitario CON IGV (precio de venta al público) */
  precioConIgv: DineroInput;
  /** Precio unitario SIN IGV (valor unitario) */
  precioSinIgv: DineroInput;
  /** Valor de venta total del item (cantidad × precioSinIgv, sin descuentos aquí) */
  valorVentaItem: DineroInput;
  /** Monto total con IGV del item */
  montoPrecioVentaItem: DineroInput;
  tipoAfectacionIgv: TipoAfectacionIgvLocal;
  /** Porcentaje IGV (ej. 18) */
  porcentajeIgv: DineroInput;
  /** Monto de IGV del item */
  montoIgvItem: DineroInput;
  descripcion: string;
}

export interface DatoAdicionalInput {
  /** Código tipo adicional SUNAT (ej. '05' = observación) */
  codigoTipo: string;
  descripcion: string;
}

/**
 * Documento referenciado en Nota de Crédito / Nota de Débito.
 * Representa al CPE original que se anula, corrige o devuelve.
 */
export interface DocReferenciadoInput {
  /** Código tipo de documento SUNAT catálogo 01 (ej. '01'=factura, '03'=boleta) */
  tipoDocumento: string;
  serie: string;
  correlativo: string;
  /** Fecha de emisión del CPE referenciado (YYYY-MM-DD o Date) */
  fechaEmision: Date | string;
}

export interface VentaCpeInput {
  tipoCpe: TipoCpeLocal;
  serie: string;
  correlativo: string | number;
  fechaEmision: Date | string;
  moneda?: string;
  tipoCambio?: string;
  correoCliente?: string;
  /** Total base imponible (suma de valorVentaItem de items gravados) */
  montoTotalGravado: DineroInput;
  /** Total IGV (suma de montoIgvItem) */
  montoTotalIgv: DineroInput;
  /** Total a pagar (gravado + igv + exonerado + inafecto - descuentos globales) */
  montoTotal: DineroInput;
  /** Código punto de venta Mifact */
  codigoPuntoVenta?: string;
  /** Código tipo de operación SUNAT (ej. '0101') */
  codigoTipoOperacionSunat?: string;
  /** Placa de vehículo (opcional, solo si aplica) */
  placa?: string;
  items: VentaItemInput[];
  datosAdicionales?: DatoAdicionalInput[];
  /** Código tipo de nota de crédito SUNAT catálogo 09. Presente solo en NC. */
  codigoTipoNc?: string;
  /** Código tipo de nota de débito SUNAT catálogo 10. Presente solo en ND. */
  codigoTipoNd?: string;
  /** Descripción libre del motivo. Presente solo en NC/ND. */
  descripcionMotivo?: string;
  /** Documentos referenciados. Presente solo en NC/ND. */
  docsReferenciado?: DocReferenciadoInput[];
  /** Monto del descuento global a nivel de cabecera (aplica sobre la base gravada). */
  descuentoGlobal?: DineroInput;
  /** Código tipo de descuento SUNAT (ej. '02' = descuento global). */
  codigoTipoDescuento?: string;
}

export interface MifactOpciones {
  enviarASunat?: boolean;
  retornarXmlEnvio?: boolean;
  retornarXmlCdr?: boolean;
  retornarPdf?: boolean;
  /** Formato de impresión: '001'=A4, '002'=A5, '004'=ticket80mm */
  formatoImpresion?: string;
}

export interface ConstruirCpeInput {
  token: string;
  emisor: EmisorInput;
  receptor: ReceptorInput;
  venta: VentaCpeInput;
  opciones?: MifactOpciones;
}

// ─── Tipo de salida — shape del JSON Mifact ───────────────────────────────────

export interface MifactItemPayload {
  COD_ITEM: string;
  COD_UNID_ITEM: string;
  CANT_UNID_ITEM: string;
  VAL_UNIT_ITEM: string;
  PRC_VTA_UNIT_ITEM: string;
  VAL_VTA_ITEM: string;
  MNT_PV_ITEM: string;
  COD_TIP_PRC_VTA: string;
  COD_TIP_AFECT_IGV_ITEM: string;
  COD_TRIB_IGV_ITEM: string;
  POR_IGV_ITEM: string;
  MNT_IGV_ITEM: string;
  TXT_DESC_ITEM: string;
}

export interface MifactDatoAdicionalPayload {
  COD_TIP_ADIC_SUNAT: string;
  TXT_DESC_ADIC_SUNAT: string;
}

/** Documento referenciado en Nota de Crédito / Nota de Débito (catálogo SUNAT 01). */
export interface MifactDocReferenciadoPayload {
  /** Código tipo de documento SUNAT catálogo 01 (ej. '01'=factura, '03'=boleta) */
  COD_TIP_DOC_REF: string;
  /** Serie del CPE referenciado */
  NUM_SERIE_CPE_REF: string;
  /** Correlativo del CPE referenciado */
  NUM_CORRE_CPE_REF: string;
  /** Fecha de emisión del CPE referenciado (YYYY-MM-DD) */
  FEC_DOC_REF: string;
}

export interface MifactCpePayload {
  TOKEN: string;
  NUM_NIF_EMIS: string;
  NOM_RZN_SOC_EMIS: string;
  NOM_COMER_EMIS: string;
  COD_UBI_EMIS: string;
  TXT_DMCL_FISC_EMIS: string;
  COD_TIP_NIF_RECP: string;
  NUM_NIF_RECP: string;
  NOM_RZN_SOC_RECP: string;
  TXT_DMCL_FISC_RECEP: string;
  FEC_EMIS: string;
  COD_TIP_CPE: string;
  NUM_SERIE_CPE: string;
  NUM_CORRE_CPE: string;
  COD_MND: string;
  TIP_CAMBIO: string;
  TXT_CORREO_ENVIO: string;
  COD_PRCD_CARGA: string;
  MNT_TOT_GRAVADO: string;
  MNT_TOT_TRIB_IGV: string;
  MNT_TOT: string;
  COD_PTO_VENTA: string;
  ENVIAR_A_SUNAT: string;
  RETORNA_XML_ENVIO: string;
  RETORNA_XML_CDR: string;
  RETORNA_PDF: string;
  COD_FORM_IMPR: string;
  TXT_VERS_UBL: string;
  TXT_VERS_ESTRUCT_UBL: string;
  COD_ANEXO_EMIS: string;
  COD_TIP_OPE_SUNAT: string;
  NUM_PLACA?: string;
  /** Código tipo de nota de crédito SUNAT catálogo 09 (ej. '01'=anulación, '06'=devolución total) */
  COD_TIP_NC?: string;
  /** Código tipo de nota de débito SUNAT catálogo 10 (ej. '01'=intereses por mora, '02'=aumento en el valor) */
  COD_TIP_ND?: string;
  /** Descripción libre del motivo de la nota de crédito o débito */
  TXT_DESC_MTVO?: string;
  /** Monto del descuento global a nivel de cabecera */
  MNT_DSCTO_GLOB?: string;
  /** Código tipo de descuento SUNAT (ej. '02' = descuento global antes de impuestos) */
  COD_TIP_DSCTO?: string;
  items: MifactItemPayload[];
  datos_adicionales?: MifactDatoAdicionalPayload[];
  /** Documentos referenciados (CPE original que se anula/corrige) */
  docs_referenciado?: MifactDocReferenciadoPayload[];
}
