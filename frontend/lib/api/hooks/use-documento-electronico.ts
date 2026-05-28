/**
 * Hooks TanStack Query para CPE / Facturación Electrónica.
 *
 * Polimórficos: aceptan `origen` que discrimina entre venta y nota de crédito.
 *
 *   useDocumentoElectronico  — GET estado actual, auto-refresh si no es estado final.
 *   useEmitirCpe             — POST emitir CPE.
 *   useReintentarCpe         — POST reintentar CPE.
 *   useConsultarEstadoCpe    — POST consultar estado en SUNAT.
 *
 * Regla de visibilidad (2026-05-28):
 *   El backend filtra el payload según permisos del usuario.
 *   - `contabilidad:leer` → DocumentoElectronicoCompleto.
 *   - Otros usuarios     → DocumentoElectronicoReducido (solo pdfUrl + serie + correlativo)
 *                          o null si el CPE no está aceptado.
 *
 *   El componente consumidor debe usar `esVistaCompleta()` para discriminar.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obtener, postear } from '@/lib/api/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EstadoSunat =
  | 'pendiente'
  | 'en_proceso'
  | 'aceptado'
  | 'aceptado_observado'
  | 'rechazado'
  | 'anulado'
  | 'baja_pendiente';

/** Payload completo — solo lo recibe el usuario con `contabilidad:leer`. */
export interface DocumentoElectronicoCompleto {
  id: string;
  ventaId: string | null;
  notaCreditoId: string | null;
  tipoCpe: string;
  serie: string;
  correlativo: string;
  estadoSunat: EstadoSunat;
  codigoHash: string | null;
  cadenaQr: string | null;
  mensajeSunat: string | null;
  xmlEnviadoUrl: string | null;
  cdrUrl: string | null;
  pdfUrl: string | null;
  numIntentos: number;
  ultimoErrorTexto: string | null;
  enviadoEn: string | null;
  aceptadoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Payload reducido — lo recibe el usuario SIN `contabilidad:leer` cuando el CPE está aceptado. */
export interface DocumentoElectronicoReducido {
  pdfUrl: string;
  serie: string;
  correlativo: string;
}

export type DocumentoElectronicoView =
  | DocumentoElectronicoCompleto
  | DocumentoElectronicoReducido;

/** Alias retro-compatible para callers que esperaban el tipo "completo". */
export type DocumentoElectronico = DocumentoElectronicoCompleto;

export function esVistaCompleta(
  doc: DocumentoElectronicoView,
): doc is DocumentoElectronicoCompleto {
  return 'estadoSunat' in doc;
}

/** Origen del CPE: venta o nota de crédito. Discrimina las URL del backend. */
export type OrigenCpe =
  | { tipo: 'venta'; id: string }
  | { tipo: 'nota-credito'; id: string };

function pathBase(origen: OrigenCpe): string {
  return origen.tipo === 'venta' ? `/ventas/${origen.id}` : `/notas-credito/${origen.id}`;
}

// Estados finales: no necesitan polling
const ESTADOS_FINALES = new Set<EstadoSunat>([
  'aceptado',
  'aceptado_observado',
  'rechazado',
  'anulado',
]);

// ─── Query key factory ────────────────────────────────────────────────────────

export const documentoElectronicoKeys = {
  detalle: (origen: OrigenCpe) => ['documento-electronico', origen.tipo, origen.id] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Obtiene el DocumentoElectronico de una venta o NC.
 * Retorna null si aún no tiene CPE emitido, o si el usuario no es contabilidad
 * y el CPE no está aceptado todavía.
 * Auto-refresca cada 30s mientras el estado no sea final (solo cuando hay vista completa).
 */
export function useDocumentoElectronico(origen: OrigenCpe) {
  return useQuery<DocumentoElectronicoView | null>({
    queryKey: documentoElectronicoKeys.detalle(origen),
    queryFn: () =>
      obtener<DocumentoElectronicoView | null>(`${pathBase(origen)}/documento-electronico`),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      // Solo poll si tenemos vista completa y el estado no es final.
      if (!esVistaCompleta(data)) return false;
      return ESTADOS_FINALES.has(data.estadoSunat) ? false : 30_000;
    },
  });
}

export function useEmitirCpe(origen: OrigenCpe) {
  const qc = useQueryClient();
  return useMutation<DocumentoElectronicoView>({
    mutationFn: () => postear<DocumentoElectronicoView>(`${pathBase(origen)}/emitir-cpe`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: documentoElectronicoKeys.detalle(origen) }),
  });
}

export function useReintentarCpe(origen: OrigenCpe) {
  const qc = useQueryClient();
  return useMutation<DocumentoElectronicoView>({
    mutationFn: () => postear<DocumentoElectronicoView>(`${pathBase(origen)}/reintentar-cpe`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: documentoElectronicoKeys.detalle(origen) }),
  });
}

export function useConsultarEstadoCpe(origen: OrigenCpe) {
  const qc = useQueryClient();
  return useMutation<DocumentoElectronicoView>({
    mutationFn: () =>
      postear<DocumentoElectronicoView>(`${pathBase(origen)}/consultar-estado-cpe`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: documentoElectronicoKeys.detalle(origen) }),
  });
}
