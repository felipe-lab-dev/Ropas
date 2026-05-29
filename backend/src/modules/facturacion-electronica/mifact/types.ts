/**
 * Tipos para MifactService — cliente HTTP contra el OSE Mifact.
 *
 * Shapes verificadas contra:
 *   - URLs_PRUEBAS.txt (endpoints)
 *   - ANULACION_DOCUMENTO.txt (LowInvoice)
 *   - "CONSULTAR ESTADO_DOCUMENTO.txt" (GetEstatusInvoice)
 *   - CONSULTAR_PDF_XML_CDR.txt (GetInvoice)
 *   - RespuestaInvoice.cs (shape de respuesta)
 */
import { z } from 'zod';
import type { EstadoSunat } from 'src/core/sunat/codigos';
import type { MifactCpePayload } from '../cpe-builder/types';

// ─── Configuración del cliente ────────────────────────────────────────────────

export interface MifactConfig {
  baseUrl: string;
  token: string;
}

// ─── Inputs por método ────────────────────────────────────────────────────────

/**
 * Payload para enviar un CPE (SendInvoice).
 * Es exactamente el MifactCpePayload que produce el orquestador.
 */
export type EnviarCpeInput = MifactCpePayload;

/**
 * Payload para anular un CPE (LowInvoice).
 * Ref: ANULACION_DOCUMENTO.txt
 */
export interface AnularCpeInput {
  /** RUC del emisor */
  NUM_NIF_EMIS: string;
  /** Fecha de emisión del CPE original (YYYY-MM-DD) */
  FEC_EMIS: string;
  /** Código tipo CPE SUNAT catálogo 01 (ej. '01'=factura, '03'=boleta) */
  COD_TIP_CPE: string;
  NUM_SERIE_CPE: string;
  NUM_CORRE_CPE: string;
  /** Motivo de la anulación */
  TXT_DESC_MTVO: string;
  /** Usuario que solicita la anulación */
  COD_PTO_VENTA?: string;
}

/**
 * Payload para consultar estado de un CPE (GetEstatusInvoice).
 * Ref: CONSULTAR ESTADO_DOCUMENTO.txt
 */
export interface ConsultarEstadoInput {
  NUM_NIF_EMIS: string;
  COD_TIP_CPE: string;
  NUM_SERIE_CPE: string;
  NUM_CORRE_CPE: string;
  /** Fecha de emisión — mejora velocidad de búsqueda; obligatorio desde nov-2021 */
  FEC_EMIS: string;
}

/**
 * Payload para obtener PDF/XML/CDR de un CPE (GetInvoice).
 * Ref: CONSULTAR_PDF_XML_CDR.txt
 */
export interface ObtenerCpeInput {
  NUM_NIF_EMIS: string;
  COD_TIP_CPE: string;
  NUM_SERIE_CPE: string;
  NUM_CORRE_CPE: string;
  /** Fecha de emisión — obligatorio desde nov-2021 */
  FEC_EMIS: string;
  RETORNA_XML_ENVIO?: string;
  RETORNA_XML_CDR?: string;
  RETORNA_PDF?: string;
  /** Formato PDF: '001'=A4, '002'=A5, '004'=ticket80mm */
  COD_FORM_IMPR?: string;
}

// ─── Respuesta cruda de Mifact ────────────────────────────────────────────────

/**
 * Shape de respuesta verificada contra RespuestaInvoice.cs de Mifact.
 * Todos los campos son string (Mifact los devuelve así, incluso los numéricos).
 */
export interface MifactRespuestaCruda {
  errors: string;
  estado_documento: string;
  tipo_cpe: string;
  serie_cpe: string;
  correlativo_cpe: string;
  url: string;
  sunat_description: string;
  sunat_note: string;
  sunat_responsecode: string;
  /** PDF en base64 */
  pdf_bytes: string;
  xml_enviado: string;
  cdr_sunat: string;
  cadena_para_codigo_qr: string;
  codigo_hash: string;
  ticket_sunat: string;
}

// ─── Schema Zod para validación en runtime ────────────────────────────────────

export const MifactRespuestaCrudaSchema = z.object({
  errors: z.string(),
  estado_documento: z.string(),
  tipo_cpe: z.string(),
  serie_cpe: z.string(),
  correlativo_cpe: z.string(),
  url: z.string(),
  sunat_description: z.string(),
  sunat_note: z.string(),
  sunat_responsecode: z.string(),
  pdf_bytes: z.string(),
  xml_enviado: z.string(),
  cdr_sunat: z.string(),
  cadena_para_codigo_qr: z.string(),
  codigo_hash: z.string(),
  ticket_sunat: z.string(),
});

// ─── Respuesta parseada (camelCase + enum mapeado) ────────────────────────────

/**
 * Respuesta de Mifact con campos en camelCase y estado SUNAT mapeado al enum
 * local via `CODIGO_A_ESTADO_SUNAT`.
 */
export interface MifactRespuesta {
  /** Errores descriptivos de Mifact; vacío si no hay error */
  errors: string;
  /** Estado SUNAT parseado desde `estado_documento` */
  estadoSunat: EstadoSunat | null;
  /** Código crudo de estado (ej. '101', '102') — por si el código es desconocido */
  estadoDocumentoCodigo: string;
  tipoCpe: string;
  serieCpe: string;
  correlativoCpe: string;
  url: string;
  sunatDescription: string;
  sunatNote: string;
  sunatResponsecode: string;
  /** PDF en base64 */
  pdfBytes: string;
  xmlEnviado: string;
  cdrSunat: string;
  cadenaParaCodigoQr: string;
  codigoHash: string;
  ticketSunat: string;
}
