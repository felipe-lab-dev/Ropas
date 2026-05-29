'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Image as ImageIcon, Upload, Loader2, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, obtener } from '@/lib/api/client';

interface TemaEstacional {
  id: string;
  nombre: string;
  categoria:
    | 'festividad-cusco'
    | 'festividad-peru'
    | 'religiosa'
    | 'comercial-internacional'
    | 'comercial-peru'
    | 'estacional'
    | 'fecha-personal';
  emoji: string;
  emojiSecundario?: string;
  colorPrimario: string;
  colorSecundario: string;
  mensajeCopy: string;
  nombreCampania: string;
  descripcionCultural: string;
  diasVigenciaSugeridos: number;
  descuentoSugeridoPct: number;
  mesEspecial?: number;
  fechaFija?: string;
  reglaCalculo?: string;
}

interface Props {
  temaActual: string;
  fondoActual: string;
  onAplicarTema: (tema: TemaEstacional) => void;
  onLimpiarTema: () => void;
  onFondoSubido: (url: string) => void;
  onQuitarFondo: () => void;
}

const CATEGORIA_LABEL: Record<TemaEstacional['categoria'], string> = {
  'festividad-cusco': '🏛️ Cusco',
  'festividad-peru': '🇵🇪 Perú',
  'religiosa': '⛪ Religiosa',
  'comercial-internacional': '🌐 Comercial',
  'comercial-peru': '🛒 Comercial Perú',
  'estacional': '🌦️ Estacional',
  'fecha-personal': '🎂 Personal',
};

const MES_NOMBRE = [
  '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export function SelectorTema({
  temaActual,
  fondoActual,
  onAplicarTema,
  onLimpiarTema,
  onFondoSubido,
  onQuitarFondo,
}: Props) {
  const [filtroCategoria, setFiltroCategoria] = React.useState<string>('');
  const [filtroMes, setFiltroMes] = React.useState<number | null>(null);
  const [subiendo, setSubiendo] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: temas = [] } = useQuery({
    queryKey: ['cupones-temas'],
    queryFn: () => obtener<TemaEstacional[]>('/cupones/temas'),
    staleTime: 5 * 60 * 1000,
  });

  const categorias = React.useMemo(
    () => Array.from(new Set(temas.map(t => t.categoria))),
    [temas],
  );

  const temasFiltrados = temas.filter(t => {
    if (filtroCategoria && t.categoria !== filtroCategoria) return false;
    if (filtroMes != null && t.mesEspecial !== filtroMes) return false;
    return true;
  });

  const mesActual = new Date().getMonth() + 1;

  const subirFondo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo PNG, JPG o WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Tamaño máximo 5 MB');
      return;
    }
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const { data } = await api.post<{ exito: boolean; datos: { url: string } }>(
        '/cupones/fondos/upload',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      onFondoSubido(data.datos.url);
      toast.success('Fondo subido — el preview ya se actualizó');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { mensaje?: string } }; message?: string };
      toast.error(err?.response?.data?.mensaje ?? err?.message ?? 'Error al subir');
    } finally {
      setSubiendo(false);
    }
  };

  const onArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    void subirFondo(f);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* ── UPLOAD CUSTOM ───────────────────────────────── */}
      <div className="rounded-xl border border-[hsl(var(--border))] p-4 bg-[hsl(var(--surface-2))]/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="size-3.5" /> Imagen de fondo personalizada
          </div>
          {fondoActual && (
            <button
              type="button"
              onClick={onQuitarFondo}
              className="text-[10px] text-[hsl(var(--text-muted))] hover:text-[hsl(355_75%_70%)] flex items-center gap-1"
            >
              <X className="size-3" /> Quitar
            </button>
          )}
        </div>
        {fondoActual ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fondoActual}
              alt="Fondo del cupón"
              className="w-24 h-16 object-cover rounded border border-[hsl(var(--border))]"
            />
            <div className="text-xs text-[hsl(var(--text-muted))] flex-1 truncate">
              {fondoActual.split('/').slice(-1)[0]}
              <div className="text-[10px] mt-0.5">El preview ya la está usando.</div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
            className="w-full rounded-lg border-2 border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/60 hover:bg-[hsl(var(--brand-primary))]/5 transition-all p-4 flex items-center gap-3 disabled:opacity-50"
          >
            <div className="size-10 rounded-md bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--brand-primary))] grid place-items-center shrink-0">
              {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            </div>
            <div className="text-left">
              <div className="text-sm font-medium">
                {subiendo ? 'Subiendo a Azure…' : 'Subir imagen propia'}
              </div>
              <p className="text-[10px] text-[hsl(var(--text-muted))]">
                PNG, JPG o WebP. Máx 5 MB. Se aplica overlay con los colores del tema para legibilidad.
              </p>
            </div>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onArchivo}
          className="hidden"
        />
      </div>

      {/* ── GALERÍA DE TEMAS ─────────────────────────────── */}
      <div className="rounded-xl border border-[hsl(var(--border))] p-4 bg-[hsl(var(--surface-2))]/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="size-3.5" /> Tema estacional
          </div>
          {temaActual && (
            <button
              type="button"
              onClick={onLimpiarTema}
              className="text-[10px] text-[hsl(var(--text-muted))] hover:text-[hsl(355_75%_70%)] flex items-center gap-1"
            >
              <X className="size-3" /> Limpiar tema
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            type="button"
            onClick={() => { setFiltroCategoria(''); setFiltroMes(null); }}
            className={`text-[10px] px-2 py-1 rounded-md ${!filtroCategoria && filtroMes == null ? 'bg-[hsl(var(--brand-primary))] text-white' : 'bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-3))]'}`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => { setFiltroCategoria(''); setFiltroMes(mesActual); }}
            className={`text-[10px] px-2 py-1 rounded-md flex items-center gap-1 ${filtroMes === mesActual ? 'bg-[hsl(var(--brand-primary))] text-white' : 'bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-3))]'}`}
          >
            <Sparkles className="size-3" /> Este mes ({MES_NOMBRE[mesActual]})
          </button>
          {categorias.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { setFiltroCategoria(c); setFiltroMes(null); }}
              className={`text-[10px] px-2 py-1 rounded-md ${filtroCategoria === c ? 'bg-[hsl(var(--brand-primary))] text-white' : 'bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-3))]'}`}
            >
              {CATEGORIA_LABEL[c as TemaEstacional['categoria']]}
            </button>
          ))}
        </div>

        {/* Grid de temas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
          {temasFiltrados.length === 0 && (
            <div className="col-span-full text-center text-xs text-[hsl(var(--text-muted))] py-6">
              No hay temas en esta categoría/mes.
            </div>
          )}
          {temasFiltrados.map(tema => {
            const activo = tema.id === temaActual;
            return (
              <button
                key={tema.id}
                type="button"
                onClick={() => onAplicarTema(tema)}
                data-testid={`tema-${tema.id}`}
                className={`group relative text-left rounded-lg overflow-hidden border-2 transition-all ${
                  activo
                    ? 'border-[hsl(var(--brand-primary))] shadow-md scale-[1.02]'
                    : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40'
                }`}
                title={`${tema.nombre}\n${tema.descripcionCultural}`}
              >
                <div
                  className="h-16 flex items-center justify-between px-3"
                  style={{
                    background: `linear-gradient(135deg, ${tema.colorPrimario} 0%, ${tema.colorSecundario} 100%)`,
                  }}
                >
                  <div className="text-2xl">{tema.emoji}</div>
                  {tema.fechaFija && (
                    <div className="text-[9px] uppercase tracking-wider font-bold text-white/70 bg-black/20 px-1.5 py-0.5 rounded">
                      {tema.fechaFija.replace('-', '/')}
                    </div>
                  )}
                  {!tema.fechaFija && tema.mesEspecial && (
                    <div className="text-[9px] uppercase tracking-wider font-bold text-white/70 bg-black/20 px-1.5 py-0.5 rounded">
                      {MES_NOMBRE[tema.mesEspecial]}
                    </div>
                  )}
                </div>
                <div className="p-2 bg-[hsl(var(--surface))]">
                  <div className="text-[11px] font-semibold leading-tight line-clamp-2">
                    {tema.nombre}
                  </div>
                  <div className="text-[9px] text-[hsl(var(--text-muted))] mt-0.5">
                    {tema.descuentoSugeridoPct}% · {tema.diasVigenciaSugeridos}d
                  </div>
                </div>
                {activo && (
                  <div className="absolute top-1 right-1 size-4 rounded-full bg-[hsl(var(--brand-primary))] text-white grid place-items-center text-[9px] font-bold shadow">
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-[hsl(var(--text-muted))]">
          Al elegir un tema se aplican sus colores, emoji, copy y nombre de campaña. Podés
          editarlo después. Combiná con una imagen de fondo para personalizarlo más.
        </p>
      </div>
    </div>
  );
}

export type { TemaEstacional };
