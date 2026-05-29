/**
 * Hooks TanStack Query para series de comprobantes.
 *
 * useSeriesCpe   — lista series (con filtro opcional por sucursal).
 * useCrearSerie  — crea una nueva serie.
 * useEditarSerie — edita una serie EXISTENTE solo si no tiene emisiones.
 *
 * REGLA DE DOMINIO:
 *   - DELETE no existe (regla fiscal).
 *   - Una serie es editable SOLO mientras no tenga comprobantes emitidos.
 *     Una vez emitido el primer comprobante, la serie es inmutable.
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
  /** Subtipo cuando tipoCpe es transversal (NC/ND). Null para factura/boleta. */
  aplicaA: TipoCpe | null;
  serie: string;
  correlativoActual: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearSerieCpeInput {
  sucursalId?: string;
  tipoCpe: TipoCpe;
  aplicaA?: TipoCpe | null;
  serie: string;
  correlativoInicial?: number;
}

export interface EditarSerieCpeInput {
  tipoCpe?: TipoCpe;
  aplicaA?: TipoCpe | null;
  serie?: string;
  correlativoInicial?: number;
}

// ─── Categorías para el dropdown del modal "Nueva serie" ──────────────────────
//
// Cada opción del dropdown mapea a un par (tipoCpe, aplicaA). NC y ND se
// desdoblan en dos opciones (una por subtipo) porque, fiscalmente, la NC debe
// usar serie distinta según refiera factura o boleta.

export type CategoriaSerie =
  | 'factura'
  | 'boleta'
  | 'nota_credito_factura'
  | 'nota_credito_boleta'
  | 'nota_debito_factura'
  | 'nota_debito_boleta'
  | 'guia_remitente'
  | 'guia_transportista';

export interface OpcionCategoria {
  value: CategoriaSerie;
  label: string;
  tipoCpe: TipoCpe;
  aplicaA: TipoCpe | null;
  prefijoSerie: string | null;
}

export const CATEGORIAS_SERIE: readonly OpcionCategoria[] = [
  { value: 'factura',              label: 'Factura',                tipoCpe: 'factura',      aplicaA: null,      prefijoSerie: 'F' },
  { value: 'boleta',               label: 'Boleta',                 tipoCpe: 'boleta',       aplicaA: null,      prefijoSerie: 'B' },
  { value: 'nota_credito_factura', label: 'Nota de Crédito (Factura)', tipoCpe: 'nota_credito', aplicaA: 'factura', prefijoSerie: 'F' },
  { value: 'nota_credito_boleta',  label: 'Nota de Crédito (Boleta)',  tipoCpe: 'nota_credito', aplicaA: 'boleta',  prefijoSerie: 'B' },
  { value: 'nota_debito_factura',  label: 'Nota de Débito (Factura)',  tipoCpe: 'nota_debito',  aplicaA: 'factura', prefijoSerie: 'F' },
  { value: 'nota_debito_boleta',   label: 'Nota de Débito (Boleta)',   tipoCpe: 'nota_debito',  aplicaA: 'boleta',  prefijoSerie: 'B' },
  { value: 'guia_remitente',       label: 'Guía de remitente',         tipoCpe: 'guia_remitente',     aplicaA: null,      prefijoSerie: null },
  { value: 'guia_transportista',   label: 'Guía de transportista',     tipoCpe: 'guia_transportista', aplicaA: null,      prefijoSerie: null },
] as const;

/** Resuelve la categoría visual a partir de (tipoCpe, aplicaA) que vienen del backend. */
export function categoriaDeSerie(s: { tipoCpe: TipoCpe; aplicaA: TipoCpe | null }): CategoriaSerie {
  const match = CATEGORIAS_SERIE.find(c => c.tipoCpe === s.tipoCpe && c.aplicaA === s.aplicaA);
  return match?.value ?? (s.tipoCpe as CategoriaSerie);
}

/** Etiqueta legible a partir de la serie del backend. */
export function labelDeSerie(s: { tipoCpe: TipoCpe; aplicaA: TipoCpe | null }): string {
  const cat = CATEGORIAS_SERIE.find(c => c.tipoCpe === s.tipoCpe && c.aplicaA === s.aplicaA);
  return cat?.label ?? s.tipoCpe;
}

// ─── Etiquetas legibles por tipoCpe puro (uso interno / legacy) ──────────────

export const LABEL_TIPO_CPE: Record<TipoCpe, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito',
  guia_remitente: 'Guía de remitente',
  guia_transportista: 'Guía de transportista',
};

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

export function useEditarSerie() {
  const qc = useQueryClient();
  return useMutation<SerieCpe, Error, { id: string; dto: EditarSerieCpeInput }>({
    mutationFn: async ({ id, dto }) => {
      const { data } = await api.put<{ datos: SerieCpe }>(`/series-cpe/${id}`, dto);
      return data.datos;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['series-cpe'] });
    },
  });
}

