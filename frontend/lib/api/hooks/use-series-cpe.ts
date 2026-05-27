/**
 * Hooks TanStack Query para series CPE.
 *
 * useSeriesCpe         — lista series (con filtro opcional por sucursal).
 * useCrearSerie        — crea una nueva serie CPE.
 * useActualizarSerie   — toggle activa (PATCH). El body solo lleva { activa }.
 *
 * REGLA DE DOMINIO:
 *   - DELETE no existe. Solo toggle activa.
 *   - correlativoActual es read-only post-creación.
 *   - serie y tipoCpe son inmutables post-creación.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoCpe =
  | 'factura'
  | 'boleta'
  | 'nota_credito'
  | 'nota_debito'
  | 'guia_remitente'
  | 'guia_transportista';

export interface SerieCpe {
  id: string;
  sucursalId: string;
  sucursal: { id: string; nombre: string };
  tipoCpe: TipoCpe;
  serie: string;
  correlativoActual: number;
  activa: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearSerieCpeInput {
  sucursalId: string;
  tipoCpe: TipoCpe;
  serie: string;
  correlativoInicial?: number;
  activa?: boolean;
}

export interface ActualizarSerieCpeInput {
  id: string;
  activa: boolean;
}

// ─── Etiquetas legibles de tipo CPE ──────────────────────────────────────────

export const LABEL_TIPO_CPE: Record<TipoCpe, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito',
  guia_remitente: 'Guía de remitente',
  guia_transportista: 'Guía de transportista',
};

export const TIPOS_CPE: { value: TipoCpe; label: string }[] = Object.entries(LABEL_TIPO_CPE).map(
  ([value, label]) => ({ value: value as TipoCpe, label }),
);

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSeriesCpe(sucursalId?: string) {
  return useQuery<SerieCpe[]>({
    queryKey: ['series-cpe', sucursalId ?? 'all'],
    queryFn: async () => {
      const params = sucursalId ? `?sucursalId=${encodeURIComponent(sucursalId)}` : '';
      const { data } = await api.get<{ datos: SerieCpe[] }>(`/series-cpe${params}`);
      return data.datos;
    },
    staleTime: 30_000,
  });
}

export function useCrearSerie() {
  const qc = useQueryClient();
  return useMutation<SerieCpe, Error, CrearSerieCpeInput>({
    mutationFn: async (dto) => {
      const { data } = await api.post<{ datos: SerieCpe }>('/series-cpe', dto);
      return data.datos;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['series-cpe'] });
    },
  });
}

export function useActualizarSerie() {
  const qc = useQueryClient();
  return useMutation<SerieCpe, Error, ActualizarSerieCpeInput>({
    mutationFn: async ({ id, ...dto }) => {
      const { data } = await api.patch<{ datos: SerieCpe }>(`/series-cpe/${id}`, dto);
      return data.datos;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['series-cpe'] });
    },
  });
}
