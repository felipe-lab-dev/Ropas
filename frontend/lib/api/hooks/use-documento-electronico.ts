/**
 * Hooks TanStack Query para CPE / Facturación Electrónica.
 *
 * useDocumentoElectronico  — GET estado actual, auto-refresh si no es estado final.
 * useEmitirCpe             — POST emitir CPE.
 * useReintentarCpe         — POST reintentar CPE.
 * useConsultarEstadoCpe    — POST consultar estado en SUNAT.
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

export interface DocumentoElectronico {
  id: string;
  ventaId: string | null;
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

// Estados finales: no necesitan polling
const ESTADOS_FINALES = new Set<EstadoSunat>([
  'aceptado',
  'aceptado_observado',
  'rechazado',
  'anulado',
]);

// ─── Query key factory ────────────────────────────────────────────────────────

export const documentoElectronicoKeys = {
  detalle: (ventaId: string) => ['documento-electronico', ventaId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Obtiene el DocumentoElectronico de una venta.
 * Retorna null si la venta aún no tiene CPE emitido.
 * Auto-refresca cada 30s mientras el estado no sea final.
 */
export function useDocumentoElectronico(ventaId: string) {
  return useQuery<DocumentoElectronico | null>({
    queryKey: documentoElectronicoKeys.detalle(ventaId),
    queryFn: () => obtener<DocumentoElectronico | null>(`/ventas/${ventaId}/documento-electronico`),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return ESTADOS_FINALES.has(data.estadoSunat) ? false : 30_000;
    },
  });
}

export function useEmitirCpe(ventaId: string) {
  const qc = useQueryClient();
  return useMutation<DocumentoElectronico>({
    mutationFn: () => postear<DocumentoElectronico>(`/ventas/${ventaId}/emitir-cpe`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: documentoElectronicoKeys.detalle(ventaId) }),
  });
}

export function useReintentarCpe(ventaId: string) {
  const qc = useQueryClient();
  return useMutation<DocumentoElectronico>({
    mutationFn: () => postear<DocumentoElectronico>(`/ventas/${ventaId}/reintentar-cpe`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: documentoElectronicoKeys.detalle(ventaId) }),
  });
}

export function useConsultarEstadoCpe(ventaId: string) {
  const qc = useQueryClient();
  return useMutation<DocumentoElectronico>({
    mutationFn: () =>
      postear<DocumentoElectronico>(`/ventas/${ventaId}/consultar-estado-cpe`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: documentoElectronicoKeys.detalle(ventaId) }),
  });
}
