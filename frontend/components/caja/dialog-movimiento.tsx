'use client';

import * as React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CreditCard,
  Check,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { postear, mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  CATEGORIAS_INGRESO,
  CATEGORIAS_EGRESO,
  SUB_CATEGORIAS_SERVICIO,
  type CategoriaMovimiento,
  type CategoriaDef,
  categoriaDef,
  tipoContraparteDe,
  pideComprobante,
  soloEfectivo,
} from './categorias';
import { ContraparteSelector } from './contraparte-selector';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sesionId: string;
  tipo: 'ingreso' | 'egreso';
  /** Indica si ya hay un movimiento de saldo_anterior en la sesión actual. */
  saldoAnteriorYaRegistrado?: boolean;
}

type Estado = {
  categoria: CategoriaMovimiento | null;
  subCategoria: string;
  medio: 'efectivo' | 'transferencia';
  moneda: 'PEN' | 'USD';
  monto: string;
  motivo: string;
  comprobante: string;
  contraparte: { nombre: string; documento?: string; id?: string } | null;
};

const ESTADO_INICIAL = (tipo: 'ingreso' | 'egreso'): Estado => ({
  categoria: null,
  subCategoria: '',
  medio: 'efectivo',
  moneda: 'PEN',
  monto: '',
  motivo: '',
  comprobante: '',
  contraparte: null,
});

export function DialogMovimiento({
  open,
  onOpenChange,
  sesionId,
  tipo,
  saldoAnteriorYaRegistrado = false,
}: Props) {
  const qc = useQueryClient();
  const [estado, setEstado] = React.useState<Estado>(() => ESTADO_INICIAL(tipo));
  const esIngreso = tipo === 'ingreso';
  const categorias = esIngreso ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
  const catActiva = categoriaDef(estado.categoria);
  const tipoContraparte = estado.categoria ? tipoContraparteDe(estado.categoria) : null;
  const pideComp = estado.categoria ? pideComprobante(estado.categoria) : false;
  const efectivoForzado = estado.categoria ? soloEfectivo(estado.categoria) : false;

  // Reset al abrir/cambiar tipo
  React.useEffect(() => {
    if (open) setEstado(ESTADO_INICIAL(tipo));
  }, [open, tipo]);

  // Si la categoría exige efectivo, forzarlo
  React.useEffect(() => {
    if (efectivoForzado && estado.medio !== 'efectivo') {
      setEstado(s => ({ ...s, medio: 'efectivo' }));
    }
  }, [efectivoForzado, estado.medio]);

  const set = <K extends keyof Estado>(k: K, v: Estado[K]) =>
    setEstado(s => ({ ...s, [k]: v }));

  const crear = useMutation({
    mutationFn: () => {
      if (!estado.categoria) return Promise.reject(new Error('Selecciona una categoría'));
      const monto = parseFloat(estado.monto);
      if (!monto || monto <= 0) return Promise.reject(new Error('Monto inválido'));
      return postear(`/caja/sesiones/${sesionId}/movimientos`, {
        tipo,
        categoria: estado.categoria,
        subCategoria: estado.subCategoria || undefined,
        medio: estado.medio === 'efectivo' ? 'efectivo' : 'transferencia',
        moneda: estado.moneda,
        monto,
        motivo: estado.motivo || catActiva?.label || 'Movimiento',
        comprobante: estado.comprobante || undefined,
        contraparte: estado.contraparte?.nombre || undefined,
        contraparteTipo: tipoContraparte ?? undefined,
        contraparteId: estado.contraparte?.id || undefined,
        contraparteDocumento: estado.contraparte?.documento || undefined,
      });
    },
    onSuccess: () => {
      toast.success(`${esIngreso ? 'Ingreso' : 'Egreso'} registrado`);
      qc.invalidateQueries({ queryKey: ['caja-movimientos', sesionId] });
      qc.invalidateQueries({ queryKey: ['caja-totales', sesionId] });
      qc.invalidateQueries({ queryKey: ['caja-desglose', sesionId] });
      onOpenChange(false);
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const puedeGuardar =
    !!estado.categoria &&
    !!estado.monto &&
    parseFloat(estado.monto) > 0 &&
    (!pideComp || estado.comprobante.length > 0 || estado.categoria === 'devolucion_proveedor') &&
    (!tipoContraparte || tipoContraparte === 'otro' || !!estado.contraparte) &&
    !crear.isPending;

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      titulo={esIngreso ? 'Registrar ingreso' : 'Registrar egreso'}
      subtitulo={
        catActiva ? catActiva.label : esIngreso ? 'Entrada de dinero a la caja' : 'Salida de dinero de la caja'
      }
      icono={
        esIngreso ? (
          <ArrowDownToLine className="size-5" />
        ) : (
          <ArrowUpFromLine className="size-5" />
        )
      }
      variante={esIngreso ? 'success' : 'danger'}
      tamano="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant={esIngreso ? 'default' : 'danger'}
            onClick={() => crear.mutate()}
            disabled={!puedeGuardar}
          >
            Registrar {esIngreso ? 'ingreso' : 'egreso'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Grid de categorías */}
        <CategoriaGrid
          categorias={categorias}
          valor={estado.categoria}
          onChange={v => set('categoria', v)}
          ingresoYaSaldoAnterior={esIngreso && saldoAnteriorYaRegistrado}
        />

        {catActiva && (
          <>
            {/* Monto + Medio de pago */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mov-monto">Monto</Label>
                  <SegmentedControl
                    size="sm"
                    ariaLabel="Moneda"
                    value={estado.moneda}
                    onChange={mon => set('moneda', mon)}
                    options={[
                      { value: 'PEN', label: 'S/ PEN' },
                      { value: 'USD', label: 'US$ USD' },
                    ]}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-[hsl(var(--brand-accent))] pointer-events-none">
                    {estado.moneda === 'USD' ? 'US$' : 'S/'}
                  </span>
                  <Input
                    id="mov-monto"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={estado.monto}
                    onChange={e => set('monto', e.target.value)}
                    className="text-xl font-bold tabular-nums pl-12 h-12"
                    autoFocus
                  />
                </div>
              </div>
              <div className="sm:col-span-3 space-y-2">
                <Label>{esIngreso ? 'Forma de cobro' : 'Forma de pago'}</Label>
                <div className="grid grid-cols-2 gap-2 h-12">
                  <BotonMedio
                    activo={estado.medio === 'efectivo'}
                    color="success"
                    icono={<Banknote className="size-4" />}
                    label="Físico"
                    onClick={() => set('medio', 'efectivo')}
                  />
                  <BotonMedio
                    activo={estado.medio === 'transferencia'}
                    color="info"
                    icono={<CreditCard className="size-4" />}
                    label="Virtual"
                    onClick={() => !efectivoForzado && set('medio', 'transferencia')}
                    disabled={efectivoForzado}
                    titulo={efectivoForzado ? 'Esta categoría solo admite efectivo' : ''}
                  />
                </div>
              </div>
            </div>

            {/* Hint contextual */}
            {catActiva.hint && (
              <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/30 px-3 py-2 text-xs text-[hsl(var(--text-muted))]">
                💡 {catActiva.hint}
              </div>
            )}

            {/* Sub-categoría servicio básico */}
            {estado.categoria === 'servicio_basico' && (
              <div className="space-y-2">
                <Label>Tipo de servicio</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SUB_CATEGORIAS_SERVICIO.map(sub => {
                    const activo = estado.subCategoria === sub.valor;
                    return (
                      <button
                        key={sub.valor}
                        type="button"
                        onClick={() => set('subCategoria', sub.valor)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                          activo
                            ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))]/10 text-[hsl(var(--brand-accent))]'
                            : 'border-[hsl(var(--border))] text-[hsl(var(--text-muted))] hover:border-[hsl(var(--brand-accent))]/40',
                        )}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Contraparte (cliente/proveedor/empleado) */}
            {tipoContraparte && (
              <ContraparteSelector
                tipo={tipoContraparte}
                valor={estado.contraparte}
                onChange={c => set('contraparte', c)}
              />
            )}

            {/* Comprobante */}
            {pideComp && (
              <div className="space-y-2">
                <Label htmlFor="mov-comp">
                  {estado.categoria === 'servicio_basico'
                    ? 'Código de pago'
                    : 'N° de comprobante'}
                </Label>
                <Input
                  id="mov-comp"
                  placeholder={estado.categoria === 'servicio_basico' ? '000123-456' : 'F001-000123'}
                  value={estado.comprobante}
                  onChange={e => set('comprobante', e.target.value)}
                  className="font-mono"
                />
              </div>
            )}

            {/* Descripción libre */}
            <div className="space-y-2">
              <Label htmlFor="mov-motivo">Descripción {estado.categoria === 'otro_ingreso' || estado.categoria === 'otro_egreso' ? '*' : '(opcional)'}</Label>
              <Textarea
                id="mov-motivo"
                rows={2}
                placeholder={
                  estado.categoria === 'otro_ingreso' || estado.categoria === 'otro_egreso'
                    ? 'Especifique de qué se trata…'
                    : 'Notas adicionales…'
                }
                value={estado.motivo}
                onChange={e => set('motivo', e.target.value)}
              />
            </div>
          </>
        )}
      </div>
    </DialogShell>
  );
}

// ----- Helpers -----

interface CategoriaGridProps {
  categorias: readonly CategoriaDef[];
  valor: CategoriaMovimiento | null;
  onChange: (v: CategoriaMovimiento) => void;
  ingresoYaSaldoAnterior: boolean;
}

function CategoriaGrid({ categorias, valor, onChange, ingresoYaSaldoAnterior }: CategoriaGridProps) {
  return (
    <div className="space-y-2">
      <Label>Categoría</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {categorias.map(cat => {
          const activo = valor === cat.valor;
          const deshabilitado = cat.valor === 'saldo_anterior' && ingresoYaSaldoAnterior;
          return (
            <button
              key={cat.valor}
              type="button"
              onClick={() => !deshabilitado && onChange(cat.valor)}
              disabled={deshabilitado}
              title={deshabilitado ? 'Ya se registró el saldo anterior en esta sesión' : ''}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-accent))]/40 min-h-[78px]',
                deshabilitado &&
                  'border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/30 text-[hsl(var(--text-muted))]/40 opacity-50 cursor-not-allowed',
                !deshabilitado && activo &&
                  'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent))]/12 text-[hsl(var(--brand-accent))] shadow-sm',
                !deshabilitado && !activo &&
                  'border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 text-[hsl(var(--text))] hover:border-[hsl(var(--brand-accent))]/40 hover:bg-[hsl(var(--brand-accent))]/5',
              )}
            >
              {activo && (
                <span className="absolute top-1 right-1 inline-flex items-center justify-center size-4 rounded-full bg-[hsl(var(--brand-accent))] text-white">
                  <Check className="size-2.5" />
                </span>
              )}
              <span className="text-2xl leading-none">{cat.icono}</span>
              <span className="text-[11px] font-bold leading-tight text-center">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface BotonMedioProps {
  activo: boolean;
  color: 'success' | 'info';
  icono: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  titulo?: string;
}

function BotonMedio({ activo, color, icono, label, onClick, disabled, titulo }: BotonMedioProps) {
  const colorClasses =
    color === 'success'
      ? 'border-[hsl(var(--brand-success))] bg-[hsl(var(--brand-success))]/10 text-[hsl(150_55%_60%)]'
      : 'border-[hsl(var(--brand-info))] bg-[hsl(var(--brand-info))]/10 text-[hsl(var(--brand-info))]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-sm font-semibold transition-all',
        activo
          ? colorClasses
          : 'border-[hsl(var(--border))] text-[hsl(var(--text-muted))] hover:border-[hsl(var(--brand-accent))]/40',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {icono}
      <span className="text-xs">{label}</span>
    </button>
  );
}
