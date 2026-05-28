'use client';

/**
 * Series CPE — pantalla CRUD de series de comprobantes de pago electrónico.
 *
 * REGLAS DE DOMINIO:
 *  - No existe DELETE. Serie desactivada → activa=false, queda en DB.
 *  - correlativoActual es read-only (solo se muestra, nunca editable).
 *  - serie y tipoCpe son inmutables post-creación.
 *  - correlativoInicial: configurable al crear (para migraciones desde otro sistema).
 *  - 1 tenant = 1 sucursal siempre. La UI no expone sucursal.
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Hash,
  Plus,
  Pencil,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  useSeriesCpe,
  useCrearSerie,
  useEditarSerie,
  CATEGORIAS_SERIE,
  categoriaDeSerie,
  labelDeSerie,
  type CategoriaSerie,
  type SerieCpe,
  type TipoCpe,
} from '@/lib/api/hooks/use-series-cpe';

// ─── Categorías habilitadas para creación desde UI ───────────────────────────
// Guías (remitente/transportista) y NC/ND de débito siguen soportadas por
// backend pero el negocio aún no las usa — se ocultan del dropdown de creación.
const CATEGORIAS_CREACION_HABILITADAS: readonly CategoriaSerie[] = [
  'factura',
  'boleta',
  'nota_credito_factura',
  'nota_credito_boleta',
] as const;

// ─── Schema del formulario ────────────────────────────────────────────────────

const schemaNuevaSerie = z.object({
  categoria: z.enum([
    'factura',
    'boleta',
    'nota_credito_factura',
    'nota_credito_boleta',
    'nota_debito_factura',
    'nota_debito_boleta',
    'guia_remitente',
    'guia_transportista',
  ] as const),
  serie: z
    .string()
    .regex(/^[A-Z]\d{3}$/, 'Formato inválido. Debe ser 1 letra mayúscula + 3 dígitos (ej: F001)'),
  correlativoInicial: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(0, 'No puede ser negativo')
    .optional(),
});

type FormNuevaSerie = z.infer<typeof schemaNuevaSerie>;

// ─── Componente: Badge de tipo CPE ───────────────────────────────────────────

const COLOR_CATEGORIA: Record<CategoriaSerie, string> = {
  factura:              'bg-blue-500/10 text-blue-400 border-blue-500/20',
  boleta:               'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  nota_credito_factura: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  nota_credito_boleta:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  nota_debito_factura:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  nota_debito_boleta:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  guia_remitente:       'bg-purple-500/10 text-purple-400 border-purple-500/20',
  guia_transportista:   'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

function BadgeTipo({ serie }: { serie: { tipoCpe: TipoCpe; aplicaA: TipoCpe | null } }) {
  const categoria = categoriaDeSerie(serie);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        COLOR_CATEGORIA[categoria],
      )}
    >
      {labelDeSerie(serie)}
    </span>
  );
}

// ─── Componente: fila de la tabla (desktop) ───────────────────────────────────

function FilaSerie({
  serie,
  onEditar,
}: {
  serie: SerieCpe;
  onEditar: (s: SerieCpe) => void;
}) {
  return (
    <TableRow data-testid={`fila-serie-${serie.id}`}>
      <TableCell>
        <BadgeTipo serie={serie} />
      </TableCell>
      <TableCell>
        <code className="rounded bg-[hsl(var(--surface-2))]/60 px-1.5 py-0.5 font-mono text-[13px]">
          {serie.serie}
        </code>
      </TableCell>
      <TableCell className="tabular-nums text-[hsl(var(--text-muted))]">
        {serie.correlativoActual.toLocaleString('es-PE')}
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEditar(serie)}
          aria-label={`Editar serie ${serie.serie}`}
          data-testid={`btn-editar-${serie.id}`}
        >
          <Pencil className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─── Componente: card mobile ──────────────────────────────────────────────────

function CardSerie({
  serie,
  onEditar,
}: {
  serie: SerieCpe;
  onEditar: (s: SerieCpe) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <BadgeTipo serie={serie} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEditar(serie)}
          aria-label={`Editar serie ${serie.serie}`}
          data-testid={`btn-editar-${serie.id}`}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-[hsl(var(--text-muted))] mb-0.5">Serie</p>
          <code className="rounded bg-[hsl(var(--surface-2))]/60 px-1.5 py-0.5 font-mono text-[13px]">
            {serie.serie}
          </code>
        </div>
        <div>
          <p className="text-[11px] text-[hsl(var(--text-muted))] mb-0.5">Correlativo actual</p>
          <p className="font-semibold tabular-nums">{serie.correlativoActual.toLocaleString('es-PE')}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Modal: Nueva serie / Editar serie ─────────────────────────────────────

function ModalSerie({
  open,
  onClose,
  serieAEditar,
}: {
  open: boolean;
  onClose: () => void;
  /** Si viene, el modal está en modo "editar"; si es null, en modo "crear". */
  serieAEditar?: SerieCpe | null;
}) {
  const crear = useCrearSerie();
  const editar = useEditarSerie();
  const esEdicion = !!serieAEditar;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormNuevaSerie>({
    resolver: zodResolver(schemaNuevaSerie),
    defaultValues: {
      categoria: 'factura',
      serie: '',
      correlativoInicial: 0,
    },
  });

  // Cuando se abre en modo edición, precargar valores de la serie.
  React.useEffect(() => {
    if (open && serieAEditar) {
      reset({
        categoria: categoriaDeSerie(serieAEditar),
        serie: serieAEditar.serie,
        correlativoInicial: serieAEditar.correlativoActual,
      });
    } else if (open && !serieAEditar) {
      reset({
        categoria: 'factura',
        serie: '',
        correlativoInicial: 0,
      });
    }
  }, [open, serieAEditar, reset]);

  const categoria = watch('categoria');
  const serieIngresada = watch('serie');

  /** Definición de la categoría seleccionada (tipoCpe, aplicaA, prefijo). */
  const catDef = React.useMemo(
    () => CATEGORIAS_SERIE.find(c => c.value === categoria) ?? CATEGORIAS_SERIE[0]!,
    [categoria],
  );

  const onSubmit = async (valores: FormNuevaSerie) => {
    const def = CATEGORIAS_SERIE.find(c => c.value === valores.categoria);
    if (!def) {
      toast.error('Categoría inválida');
      return;
    }
    try {
      if (esEdicion && serieAEditar) {
        await editar.mutateAsync({
          id: serieAEditar.id,
          dto: {
            tipoCpe: def.tipoCpe,
            aplicaA: def.aplicaA,
            serie: valores.serie,
            correlativoInicial: valores.correlativoInicial,
          },
        });
        toast.success(`Serie ${valores.serie} actualizada`);
      } else {
        await crear.mutateAsync({
          tipoCpe: def.tipoCpe,
          aplicaA: def.aplicaA,
          serie: valores.serie,
          correlativoInicial: valores.correlativoInicial,
        });
        toast.success(`Serie ${valores.serie} creada`);
      }
      reset();
      onClose();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  const enviando = esEdicion ? editar.isPending : crear.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) { reset(); onClose(); }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {esEdicion ? (
              <Pencil className="size-4 text-[hsl(var(--brand-primary))]" />
            ) : (
              <Hash className="size-4 text-[hsl(var(--brand-primary))]" />
            )}
            {esEdicion ? 'Editar serie' : 'Nueva serie'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Tipo de comprobante (Categoría) */}
          <div className="space-y-1.5">
            <Label>Tipo de comprobante</Label>
            <div className="relative">
              <select
                {...register('categoria')}
                className={cn(
                  'flex h-10 w-full appearance-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] pl-3.5 pr-9 py-2 text-sm cursor-pointer',
                  'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
                  'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15 transition-all',
                )}
                data-testid="select-tipo-cpe"
              >
                {CATEGORIAS_SERIE
                  .filter((c) => CATEGORIAS_CREACION_HABILITADAS.includes(c.value))
                  .map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]"
                aria-hidden="true"
              />
            </div>
            {errors.categoria && (
              <p className="text-xs text-[hsl(var(--brand-danger))]">{errors.categoria.message}</p>
            )}
          </div>

          {/* Serie */}
          <div className="space-y-1.5">
            <Label>Serie</Label>
            <Input
              {...register('serie')}
              placeholder={catDef.prefijoSerie ? `${catDef.prefijoSerie}001` : 'X001'}
              maxLength={4}
              className="font-mono uppercase"
              data-testid="input-serie"
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
                register('serie').onChange(e);
              }}
            />
            {errors.serie && (
              <p className="text-xs text-[hsl(var(--brand-danger))]" data-testid="error-serie">
                {errors.serie.message}
              </p>
            )}
            <p className="text-[11px] text-[hsl(var(--text-muted))]">
              Convención: Factura y NC-Factura → F001; Boleta y NC-Boleta → B001. Formato: 1 letra + 3 dígitos.
            </p>
          </div>

          {/* Correlativo inicial */}
          <div className="space-y-1.5">
            <Label>
              Correlativo inicial
              <span className="ml-1.5 normal-case text-[10px] font-normal text-[hsl(var(--text-muted))]">
                (opcional)
              </span>
            </Label>
            <Input
              {...register('correlativoInicial')}
              type="number"
              min={0}
              defaultValue={0}
              data-testid="input-correlativo-inicial"
            />
            {errors.correlativoInicial && (
              <p className="text-xs text-[hsl(var(--brand-danger))]">{errors.correlativoInicial.message}</p>
            )}
            <p className="text-[11px] text-[hsl(var(--text-muted))]">
              Si está migrando desde otro sistema y desea continuar la numeración, ingrese el último
              correlativo emitido. Si comienza desde cero, deje en 0.
            </p>
          </div>

          {/* Advertencia coherencia letra↔categoría */}
          <AnimatePresence>
            {catDef.prefijoSerie && serieIngresada && !serieIngresada.startsWith(catDef.prefijoSerie) && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-[hsl(var(--brand-warning))]/10 text-[hsl(var(--brand-warning))] border border-[hsl(var(--brand-warning))]/20"
              >
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  Por convención, <strong>{catDef.label}</strong> debe empezar con{' '}
                  <strong>{catDef.prefijoSerie}</strong> (ej: {catDef.prefijoSerie}001). El sistema rechazará esta combinación.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-end gap-3 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={enviando}
              data-testid="btn-guardar-serie"
            >
              {enviando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando...
                </>
              ) : esEdicion ? (
                <>
                  <Pencil className="size-4" />
                  Guardar cambios
                </>
              ) : (
                <>
                  <Hash className="size-4" />
                  Crear serie
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TablaSkleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SeriesCpePage() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [serieEditando, setSerieEditando] = React.useState<SerieCpe | null>(null);

  const { data: series = [], isLoading: loadingSeries } = useSeriesCpe();

  const abrirEditar = (serie: SerieCpe) => {
    setSerieEditando(serie);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setSerieEditando(null);
  };
  // ─── Detección de gaps: si hay factura/boleta pero falta NC del mismo subtipo ──
  //
  // Heurística defensiva: si el tenant tiene serie de factura, también debería
  // tener NC-Factura. Si la falta, al intentar emitir una NC sobre una venta
  // con factura el backend rechazará. Avisamos acá antes.
  const gapsNc = React.useMemo(() => {
    const existe = (
      tipoCpe: TipoCpe,
      aplicaA: TipoCpe | null,
    ): boolean => series.some(
      s => s.tipoCpe === tipoCpe && s.aplicaA === aplicaA,
    );
    const gaps: string[] = [];
    if (existe('factura', null) && !existe('nota_credito', 'factura')) {
      gaps.push('NC-Factura');
    }
    if (existe('boleta', null) && !existe('nota_credito', 'boleta')) {
      gaps.push('NC-Boleta');
    }
    return gaps;
  }, [series]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-muted))]">
        <span>Configuración</span>
        <ChevronRight className="size-3.5" />
        <span className="text-[hsl(var(--text))] font-medium">Series de comprobantes</span>
      </div>

      <PageHeader
        titulo="Series de comprobantes electrónicos"
        descripcion="Series para emitir comprobantes electrónicos (Factura, Boleta, etc.)."
        acciones={
          <Button
            size="lg"
            onClick={() => { setSerieEditando(null); setModalOpen(true); }}
            data-testid="btn-nueva-serie"
          >
            <Plus className="size-4" />
            Nueva serie
          </Button>
        }
      />

      {/* ── Banner: faltan series de NC para los tipos activos ────────────── */}
      <AnimatePresence>
        {gapsNc.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-3 rounded-xl border border-[hsl(var(--brand-warning))]/30 bg-[hsl(var(--brand-warning))]/10 px-4 py-3"
            data-testid="banner-gaps-nc"
          >
            <AlertTriangle className="size-5 shrink-0 text-[hsl(var(--brand-warning))] mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-[hsl(var(--brand-warning))]">
                Configuración incompleta de Notas de Crédito
              </p>
              <p className="mt-0.5 text-[13px] text-[hsl(var(--text))]">
                Tiene serie de{' '}
                {gapsNc.includes('NC-Factura') && gapsNc.includes('NC-Boleta')
                  ? 'Factura y Boleta'
                  : gapsNc.includes('NC-Factura')
                    ? 'Factura'
                    : 'Boleta'}{' '}
                pero falta crear{' '}
                <strong>{gapsNc.join(' y ')}</strong>. Si intenta emitir una nota
                de crédito sobre una venta con comprobante electrónico, la operación
                fallará. Cree las series faltantes desde el botón <em>Nueva serie</em>.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabla desktop ─────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        {loadingSeries ? (
          <TablaSkleton />
        ) : series.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="size-16 rounded-2xl bg-[hsl(var(--brand-primary))]/10 text-[hsl(var(--brand-primary))] grid place-items-center mb-4">
              <Hash className="size-7" />
            </div>
            <p className="text-base font-semibold mb-1">No hay series configuradas</p>
            <p className="text-sm text-[hsl(var(--text-muted))] mb-4 max-w-xs">
              Cree al menos una serie por tipo de comprobante para poder emitir facturas electrónicas.
            </p>
            <Button onClick={() => { setSerieEditando(null); setModalOpen(true); }}>
              <Plus className="size-4" />
              Crear primera serie
            </Button>
          </motion.div>
        ) : (
          <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Serie</TableHead>
                  <TableHead>Correlativo actual</TableHead>
                  <TableHead className="w-16 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((serie) => (
                  <FilaSerie key={serie.id} serie={serie} onEditar={abrirEditar} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Cards mobile ──────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {loadingSeries ? (
          <TablaSkleton />
        ) : series.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Hash className="size-10 text-[hsl(var(--text-muted))] mb-3" />
            <p className="text-sm font-medium mb-1">Sin series configuradas</p>
            <p className="text-xs text-[hsl(var(--text-muted))] mb-4">
              Toque + Nueva serie para comenzar.
            </p>
            <Button size="sm" onClick={() => { setSerieEditando(null); setModalOpen(true); }}>
              <Plus className="size-4" />
              Nueva serie
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {series.map((serie) => (
              <CardSerie key={serie.id} serie={serie} onEditar={abrirEditar} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Modal Nueva / Editar serie ────────────────────────────────────── */}
      <ModalSerie
        open={modalOpen}
        onClose={cerrarModal}
        serieAEditar={serieEditando}
      />
    </div>
  );
}
