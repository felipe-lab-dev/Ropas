/**
 * filtrarDocumentoSegunPermisos — regla 2026-05-28 de visibilidad del CPE.
 *
 * - Usuario con `contabilidad:leer` (o `*`) → objeto DocumentoElectronico completo.
 * - Otros usuarios:
 *     - Si el CPE no está aceptado/aceptado_observado → null (silencio total).
 *     - Si está aceptado y tiene pdfUrl → `{pdfUrl, serie, correlativo}` solamente.
 *     - Si está aceptado pero no tiene pdfUrl → null.
 *
 * NUNCA expone a no-contabilidad: estado SUNAT, hash, error, XML, CDR,
 * cadena QR, fechas de envío.
 */
import type { DocumentoElectronico } from '@prisma/client';

export interface DocumentoElectronicoVistaReducida {
  pdfUrl: string;
  serie: string;
  correlativo: string;
}

export function filtrarDocumentoSegunPermisos(
  doc: DocumentoElectronico | null,
  permisos: string[],
): DocumentoElectronico | DocumentoElectronicoVistaReducida | null {
  if (!doc) return null;

  const puedeVerCompleto =
    permisos.includes('contabilidad:leer') || permisos.includes('*');
  if (puedeVerCompleto) return doc;

  const estaAceptado =
    doc.estadoSunat === 'aceptado' || doc.estadoSunat === 'aceptado_observado';
  if (!estaAceptado) return null;
  if (!doc.pdfUrl) return null;

  return {
    pdfUrl: doc.pdfUrl,
    serie: doc.serie,
    correlativo: doc.correlativo,
  };
}
