'use client';

import * as React from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { postear, mensajeError } from '@/lib/api/client';
import { MEDIOS_PAGO, type MedioPago } from './medio-pago';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sesionId: string;
  tipo: 'ingreso' | 'egreso';
}

export function DialogMovimiento({ open, onOpenChange, sesionId, tipo }: Props) {
  const [medio, setMedio] = React.useState<MedioPago>('efectivo');
  const [monto, setMonto] = React.useState('');
  const [motivo, setMotivo] = React.useState('');
  const [comprobante, setComprobante] = React.useState('');
  const [contraparte, setContraparte] = React.useState('');
  const qc = useQueryClient();

  const esIngreso = tipo === 'ingreso';

  const reset = () => {
    setMedio('efectivo');
    setMonto('');
    setMotivo('');
    setComprobante('');
    setContraparte('');
  };

  const crear = useMutation({
    mutationFn: () =>
      postear(`/caja/sesiones/${sesionId}/movimientos`, {
        tipo,
        medio,
        monto: parseFloat(monto),
        motivo,
        comprobante: comprobante || undefined,
        contraparte: contraparte || undefined,
      }),
    onSuccess: () => {
      toast.success(`${esIngreso ? 'Ingreso' : 'Egreso'} registrado`);
      reset();
      qc.invalidateQueries({ queryKey: ['caja-movimientos', sesionId] });
      qc.invalidateQueries({ queryKey: ['caja-totales', sesionId] });
      onOpenChange(false);
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={o => {
        if (!o) reset();
        onOpenChange(o);
      }}
      titulo={esIngreso ? 'Registrar ingreso manual' : 'Registrar egreso manual'}
      subtitulo={esIngreso ? 'Entrada de dinero a la caja' : 'Salida de dinero de la caja'}
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
            disabled={!monto || !motivo || crear.isPending}
          >
            Registrar {esIngreso ? 'ingreso' : 'egreso'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mov-medio">Medio de pago</Label>
            <Select
              id="mov-medio"
              value={medio}
              onChange={e => setMedio(e.target.value as MedioPago)}
            >
              {MEDIOS_PAGO.map(m => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mov-monto">Monto</Label>
            <Input
              id="mov-monto"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              className="text-lg font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mov-comp">N° comprobante (opcional)</Label>
            <Input
              id="mov-comp"
              placeholder="S/N"
              value={comprobante}
              onChange={e => setComprobante(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mov-contra">
              {esIngreso ? 'Cliente / origen' : 'Proveedor / destino'} (opcional)
            </Label>
            <Input
              id="mov-contra"
              placeholder={esIngreso ? 'Nombre del cliente…' : 'Nombre del proveedor…'}
              value={contraparte}
              onChange={e => setContraparte(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mov-motivo">Motivo / Descripción</Label>
          <Textarea
            id="mov-motivo"
            rows={3}
            placeholder={
              esIngreso
                ? 'Especifique el origen del ingreso…'
                : 'Especifique el motivo del egreso…'
            }
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
          />
        </div>
      </div>
    </DialogShell>
  );
}
