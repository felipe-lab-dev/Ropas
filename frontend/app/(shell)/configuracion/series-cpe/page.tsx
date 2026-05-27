'use client';

/**
 * Series CPE — pantalla CRUD de series de comprobantes de pago electrónico.
 *
 * REGLAS DE DOMINIO:
 *  - No existe DELETE. Serie desactivada → activa=false, queda en DB.
 *  - correlativoActual es read-only (solo se muestra, nunca editable).
 *  - serie y tipoCpe son inmutables post-creación.
 *  - correlativoInicial: configurable al crear (para migraciones desde otro sistema).
 */
import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Hash,
  Plus,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
import { obtener } from '@/lib/api/client';
import { mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  useSeriesCpe,
  useCrearSerie,
  useActualizarSerie,
  LABEL_TIPO_CPE,
  TIPOS_CPE,
  type SerieCpe,
  type TipoCpe,
} from '@/lib/api/hooks/use-series-cpe';

// ─── Sucursal (local, sin hook dedicado — consume /sucursales) ────────────────

interface Sucursal {
  id: string;
  nombre: string;
  esPrincipal: boolean;
  activa: boolean;
}

function useSucursales() {
  return useQuery<Sucursal[]>({
    queryKey: ['sucursales-listado'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
    staleTime: 60_000,
  });
}

// ─── Schema del formulario ────────────────────────────────────────────────────

const schemaNuevaSerie = z.object({
  sucursalId: z.string().uuid('Selecciona una sucursal'),
  tipoCpe: z.enum([
    'factura',
    'boleta',
    'nota_credito',
    'nota_debito',
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
  activa: z.boolean(),
});

type FormNuevaSerie = z.infer<typeof schemaNuevaSerie>;

// ─── Componente: Toggle ───────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? (checked ? 'Activa' : 'Inactiva')}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-primary))] min-w-[44px] min-h-[44px] items-center justify-center',
        checked
          ? 'bg-[hsl(var(--brand-primary))]'
          : 'bg-[hsl(var(--border))]',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 rounded-full bg-white shadow-md',
          'transform transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

// ─── Componente: Badge de tipo CPE ───────────────────────────────────────────

const COLOR_TIPO: Record<TipoCpe, string> = {
  factura: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  boleta: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  nota_credito: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  nota_debito: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  guia_remitente: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  guia_transportista: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

function BadgeTipo({ tipo }: { tipo: TipoCpe }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        COLOR_TIPO[tipo],
      )}
    >
      {LABEL_TIPO_CPE[tipo]}
    </span>
  );
}

// ─── Componente: fila de la tabla (desktop) ───────────────────────────────────

function FilaSerie({ serie, onToggle }: { serie: SerieCpe; onToggle: (s: SerieCpe) => void }) {
  return (
    <TableRow
      data-testid={`fila-serie-${serie.id}`}
      className={cn(
        'transition-opacity',
        !serie.activa && 'opacity-50',
      )}
    >
      <TableCell className="font-medium">
        {serie.sucursal.nombre}
      </TableCell>
      <TableCell>
        <BadgeTipo tipo={serie.tipoCpe} />
      </TableCell>
      <TableCell>
        <code className="rounded bg-[hsl(var(--surface-2))]/60 px-1.5 py-0.5 font-mono text-[13px]">
          {serie.serie}
        </code>
      </TableCell>
      <TableCell className="tabular-nums text-[hsl(var(--text-muted))]">
        {serie.correlativoActual.toLocaleString('es-PE')}
      </TableCell>
      <TableCell>
        <Toggle
          checked={serie.activa}
          onChange={() => onToggle(serie)}
          label={`Toggle activa para ${serie.serie}`}
        />
      </TableCell>
    </TableRow>
  );
}

// ─── Componente: card mobile ──────────────────────────────────────────────────

function CardSerie({ serie, onToggle }: { serie: SerieCpe; onToggle: (s: SerieCpe) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cn(
        'rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 space-y-3 transition-opacity',
        !serie.activa && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[hsl(var(--text-muted))]">
            <Building2 className="size-3 inline-block mr-1" />
            {serie.sucursal.nombre}
          </p>
          <div className="mt-1">
            <BadgeTipo tipo={serie.tipoCpe} />
          </div>
        </div>
        <Toggle
          checked={serie.activa}
          onChange={() => onToggle(serie)}
          label={`Toggle activa para ${serie.serie}`}
        />
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

// ─── Modal: Nueva serie ───────────────────────────────────────────────────────

function ModalNuevaSerie({
  open,
  onClose,
  sucursales,
}: {
  open: boolean;
  onClose: () => void;
  sucursales: Sucursal[];
}) {
  const crear = useCrearSerie();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormNuevaSerie>({
    resolver: zodResolver(schemaNuevaSerie),
    defaultValues: {
      sucursalId: sucursales[0]?.id ?? '',
      tipoCpe: 'factura',
      serie: '',
      correlativoInicial: 0,
      activa: true,
    },
  });

  const tipoCpe = watch('tipoCpe');

  // Resetear serie al cambiar tipo para evitar inconsistencias
  const prevTipoRef = React.useRef(tipoCpe);
  React.useEffect(() => {
    if (prevTipoRef.current !== tipoCpe) {
      prevTipoRef.current = tipoCpe;
    }
  }, [tipoCpe]);

  const onSubmit = async (valores: FormNuevaSerie) => {
    try {
      await crear.mutateAsync({
        sucursalId: valores.sucursalId,
        tipoCpe: valores.tipoCpe,
        serie: valores.serie,
        correlativoInicial: valores.correlativoInicial,
        activa: valores.activa,
      });
      toast.success(`Serie ${valores.serie} creada`);
      reset();
      onClose();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

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
            <Hash className="size-4 text-[hsl(var(--brand-primary))]" />
            Nueva serie CPE
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Sucursal */}
          <div className="space-y-1.5">
            <Label>Sucursal</Label>
            <select
              {...register('sucursalId')}
              className={cn(
                'flex h-10 w-full appearance-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] pl-3.5 pr-9 py-2 text-sm',
                'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
                'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15 transition-all',
              )}
              data-testid="select-sucursal"
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}{s.esPrincipal ? ' (Principal)' : ''}
                </option>
              ))}
            </select>
            {errors.sucursalId && (
              <p className="text-xs text-[hsl(var(--brand-danger))]">{errors.sucursalId.message}</p>
            )}
          </div>

          {/* Tipo CPE */}
          <div className="space-y-1.5">
            <Label>Tipo de comprobante</Label>
            <select
              {...register('tipoCpe')}
              className={cn(
                'flex h-10 w-full appearance-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] pl-3.5 pr-9 py-2 text-sm',
                'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
                'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15 transition-all',
              )}
              data-testid="select-tipo-cpe"
            >
              {TIPOS_CPE.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {errors.tipoCpe && (
              <p className="text-xs text-[hsl(var(--brand-danger))]">{errors.tipoCpe.message}</p>
            )}
          </div>

          {/* Serie */}
          <div className="space-y-1.5">
            <Label>Serie</Label>
            <Input
              {...register('serie')}
              placeholder={tipoCpe === 'factura' ? 'F001' : tipoCpe === 'boleta' ? 'B001' : 'X001'}
              maxLength={4}
              className="font-mono uppercase"
              data-testid="input-serie"
              onChange={(e) => {
                // Forzar uppercase on-change
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
              Convención: Factura → F001, Boleta → B001. Formato: 1 letra + 3 dígitos.
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
              Si estás migrando desde otro sistema y quieres continuar la numeración, ingresa el último
              correlativo emitido. Si arrancas de cero, deja en 0.
            </p>
          </div>

          {/* Activa */}
          <div className="flex items-center gap-3">
            <Controller
              name="activa"
              control={control}
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onChange={field.onChange}
                  label="Serie activa"
                />
              )}
            />
            <span className="text-sm text-[hsl(var(--text))]">Serie activa desde el inicio</span>
          </div>

          {/* Advertencia coherencia letra↔tipo */}
          <AnimatePresence>
            {((tipoCpe === 'factura' && watch('serie') && !watch('serie').startsWith('F')) ||
              (tipoCpe === 'boleta' && watch('serie') && !watch('serie').startsWith('B'))) && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-[hsl(var(--brand-warning))]/10 text-[hsl(var(--brand-warning))] border border-[hsl(var(--brand-warning))]/20"
              >
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  Por convención, las {tipoCpe === 'factura' ? 'facturas' : 'boletas'} empiezan con{' '}
                  <strong>{tipoCpe === 'factura' ? 'F' : 'B'}</strong> (ej:{' '}
                  {tipoCpe === 'factura' ? 'F001' : 'B001'}). El sistema rechazará esta combinación.
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
              disabled={crear.isPending}
              data-testid="btn-guardar-serie"
            >
              {crear.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando...
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
  const [sucursalFiltro, setSucursalFiltro] = React.useState<string | undefined>();
  const [modalOpen, setModalOpen] = React.useState(false);

  const { data: series = [], isLoading: loadingSeries } = useSeriesCpe(sucursalFiltro);
  const { data: sucursales = [], isLoading: loadingSucursales } = useSucursales();
  const actualizarSerie = useActualizarSerie();

  const handleToggle = async (serie: SerieCpe) => {
    try {
      await actualizarSerie.mutateAsync({ id: serie.id, activa: !serie.activa });
      toast.success(
        `Serie ${serie.serie} ${!serie.activa ? 'activada' : 'desactivada'}`,
      );
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-muted))]">
        <span>Configuración</span>
        <ChevronRight className="size-3.5" />
        <span className="text-[hsl(var(--text))] font-medium">Series CPE</span>
      </div>

      <PageHeader
        titulo="Series CPE"
        descripcion="Series para emitir comprobantes electrónicos (Factura, Boleta, etc.)."
        acciones={
          <Button
            size="lg"
            onClick={() => setModalOpen(true)}
            data-testid="btn-nueva-serie"
          >
            <Plus className="size-4" />
            Nueva serie
          </Button>
        }
      />

      {/* Filtro por sucursal */}
      {sucursales.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm whitespace-nowrap">Filtrar por sucursal</Label>
          <select
            value={sucursalFiltro ?? ''}
            onChange={(e) => setSucursalFiltro(e.target.value || undefined)}
            className={cn(
              'h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-1.5 text-sm',
              'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
              'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15 transition-all',
              'max-w-[240px]',
            )}
            data-testid="filtro-sucursal"
          >
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      )}

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
              Crea al menos una serie por tipo de comprobante para poder emitir facturas electrónicas.
            </p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Crear primera serie
            </Button>
          </motion.div>
        ) : (
          <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Tipo CPE</TableHead>
                  <TableHead>Serie</TableHead>
                  <TableHead>Correlativo actual</TableHead>
                  <TableHead>Activa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((serie) => (
                  <FilaSerie
                    key={serie.id}
                    serie={serie}
                    onToggle={handleToggle}
                  />
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
              Toca + Nueva serie para empezar.
            </p>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Nueva serie
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {series.map((serie) => (
              <CardSerie
                key={serie.id}
                serie={serie}
                onToggle={handleToggle}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Modal Nueva serie ─────────────────────────────────────────────── */}
      <ModalNuevaSerie
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sucursales={sucursales}
      />
    </div>
  );
}
