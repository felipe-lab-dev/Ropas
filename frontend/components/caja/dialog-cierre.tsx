'use client';

import * as React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { useValidacionForm } from '@/lib/use-validacion-form';
import { postear, mensajeError } from '@/lib/api/client';
import { formatearMoneda } from '@/lib/utils';

<<<<<<< HEAD
interface FormCierre {
  monto: string;
=======
interface SaldoMonedaTotales {
  moneda: string;
  apertura: number;
  ingresos: number;
  egresos: number;
  efectivoEsperado: number;
>>>>>>> 7af26ac3e43321f6fdb1128c8298ba12a07f9eda
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sesionId: string;
  efectivoEsperado: number;
  /** Monedas adicionales a PEN presentes en la sesión (USD…) para arquear aparte. */
  porMoneda?: SaldoMonedaTotales[];
}

export function DialogCierre({
  open,
  onOpenChange,
  sesionId,
  efectivoEsperado,
  porMoneda = [],
}: Props) {
  const [monto, setMonto] = React.useState('');
  const [montosExtra, setMontosExtra] = React.useState<Record<string, string>>({});
  const [notas, setNotas] = React.useState('');
  const qc = useQueryClient();

  const diferencia = monto ? parseFloat(monto) - efectivoEsperado : 0;
  const tieneDiferencia = Math.abs(diferencia) >= 0.01;

  const validacion = useValidacionForm<FormCierre>({
    reglas: [
      {
        id: 'cierre-monto',
        label: 'Monto contado al cierre',
        validar: d => {
          if (!d.monto.trim()) return 'Ingresa el monto contado';
          const n = parseFloat(d.monto);
          if (Number.isNaN(n) || n < 0) return 'Monto inválido';
          return null;
        },
      },
    ],
  });

  const cerrar = useMutation({
    mutationFn: () =>
      postear(`/caja/${sesionId}/cerrar`, {
        montoCierre: parseFloat(monto),
        cierresMoneda: porMoneda
          .filter(p => (montosExtra[p.moneda] ?? '') !== '')
          .map(p => ({ moneda: p.moneda, monto: parseFloat(montosExtra[p.moneda]!) })),
        notas: notas || undefined,
      }),
    onSuccess: () => {
      toast.success('Caja cerrada');
      setMonto('');
      setMontosExtra({});
      setNotas('');
      qc.invalidateQueries({ queryKey: ['caja-mi-sesion'] });
      qc.invalidateQueries({ queryKey: ['caja-sesiones'] });
      qc.invalidateQueries({ queryKey: ['caja-totales'] });
      onOpenChange(false);
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const onCerrar = () => {
    const r = validacion.validar({ monto });
    if (!r.valido) return;
    cerrar.mutate();
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      titulo="Cierre de caja"
      subtitulo="Arqueo y cierre de sesión"
      icono={<Lock className="size-5" />}
      variante="danger"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onCerrar}
            disabled={cerrar.isPending}
            data-testid="btn-cerrar-caja"
          >
            <Lock className="size-4" /> Cerrar caja
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-bold">
              Efectivo esperado
            </p>
            <p className="text-xl font-bold tabular-nums mt-1">
              {formatearMoneda(efectivoEsperado)}
            </p>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              !monto
                ? 'border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40'
                : tieneDiferencia
                ? 'border-[hsl(35_90%_55%)]/40 bg-[hsl(35_90%_55%)]/10'
                : 'border-[hsl(var(--brand-success))]/40 bg-[hsl(var(--brand-success))]/10'
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--text-muted))] font-bold">
              Diferencia
            </p>
            <p
              className={`text-xl font-bold tabular-nums mt-1 ${
                !monto ? '' : tieneDiferencia ? 'text-[hsl(35_90%_65%)]' : 'text-[hsl(150_55%_60%)]'
              }`}
            >
              {monto ? formatearMoneda(diferencia) : '—'}
            </p>
          </div>
        </div>

        <FormField
          label="Monto contado al cierre"
          htmlFor="cierre-monto"
          requerido
          error={validacion.errores['cierre-monto']}
        >
          <Input
            id="cierre-monto"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={monto}
            onChange={e => {
              setMonto(e.target.value);
              validacion.limpiarError('cierre-monto');
            }}
            className="text-lg font-mono"
            autoFocus
          />
        </FormField>

        {porMoneda.map(p => {
          const contado = montosExtra[p.moneda] ?? '';
          const dif = contado !== '' ? parseFloat(contado) - p.efectivoEsperado : 0;
          const hayDif = contado !== '' && Math.abs(dif) >= 0.01;
          return (
            <div
              key={p.moneda}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/30 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))]">
                  Arqueo {p.moneda}
                </span>
                <span className="text-xs text-[hsl(var(--text-muted))]">
                  Esperado{' '}
                  <strong className="tabular-nums">
                    {formatearMoneda(p.efectivoEsperado, p.moneda)}
                  </strong>
                </span>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={`Contado en ${p.moneda}`}
                value={contado}
                onChange={e => setMontosExtra(s => ({ ...s, [p.moneda]: e.target.value }))}
                className="font-mono"
              />
              {hayDif && (
                <p className="text-[11px] text-[hsl(35_90%_65%)]">
                  Diferencia {formatearMoneda(dif, p.moneda)} — quedará marcada para revisión.
                </p>
              )}
            </div>
          );
        })}

        <div className="space-y-2">
          <Label htmlFor="cierre-notas">Notas de cierre (opcional)</Label>
          <Textarea
            id="cierre-notas"
            rows={3}
            placeholder="Observaciones del arqueo…"
            value={notas}
            onChange={e => setNotas(e.target.value)}
          />
        </div>

        {monto && tieneDiferencia && (
          <div className="flex items-start gap-2 rounded-lg border border-[hsl(35_90%_55%)]/40 bg-[hsl(35_90%_55%)]/10 p-3 text-xs text-[hsl(35_90%_75%)]">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              Hay diferencia de {formatearMoneda(diferencia)}. La sesión quedará marcada como{' '}
              <strong>con diferencia</strong> para revisión.
            </span>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
