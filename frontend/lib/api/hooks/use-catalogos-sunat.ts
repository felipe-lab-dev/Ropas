/**
 * Hooks TanStack Query para catálogos SUNAT estáticos.
 *
 * staleTime: Infinity → nunca se re-fetcha mientras el proceso viva.
 * Los catálogos SUNAT cambian ~cada 5 años y el backend ya los cachea 24h.
 *
 * useUnidadesMedida     — Catálogo 03: unidades de medida (~8 entradas para retail).
 * useTiposAfectacionIgv — Catálogo 07: tipos de afectación IGV (19 entradas).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface UnidadMedida {
  codigo: string;
  nombre: string;
  simbolo: string;
}

export interface TipoAfectacionIgv {
  codigo: string;
  sunatCodigo: string;
  nombre: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useUnidadesMedida() {
  return useQuery<UnidadMedida[]>({
    queryKey: ['catalogos', 'unidades-medida'],
    queryFn: async () => {
      const { data } = await api.get<{ datos: UnidadMedida[] }>('/catalogos/unidades-medida');
      return data.datos;
    },
    staleTime: Infinity,
  });
}

export function useTiposAfectacionIgv() {
  return useQuery<TipoAfectacionIgv[]>({
    queryKey: ['catalogos', 'tipos-afectacion-igv'],
    queryFn: async () => {
      const { data } = await api.get<{ datos: TipoAfectacionIgv[] }>('/catalogos/tipos-afectacion-igv');
      return data.datos;
    },
    staleTime: Infinity,
  });
}
