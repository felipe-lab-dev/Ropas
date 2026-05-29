'use client';

import * as React from 'react';
import { Unlock, Wallet } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { postear, mensajeError } from '@/lib/api/client';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sucursalId: string;
  sucursalNombre?: string;
}

export function DialogApertura({ open, onOpenChange, sucursalId, sucursalNombre }: Props) {
  const [monto, setMonto] = React.useState('');
  const [montoUsd, setMontoUsd] = React.useState('');
  const [notas, setNotas] = React.useState('');
  const qc = useQueryClient();

  const abrir = useMutation({
    mutationFn: () =>
      postear('/caja/abrir', {
        sucursalId,
        montoApertura: parseFloat(monto),
        aperturasMoneda:
          montoUsd && parseFloat(montoUsd) > 0
            ? [{ moneda: 'USD', monto: parseFloat(montoUsd) }]
            : undefined,
        notas: notas || undefined,
      }),
    onSuccess: () => {
      toast.success('Caja abierta correctamente');
      setMonto('');
      setMontoUsd('');
      setNotas('');
      qc.invalidateQueries({ queryKey: ['caja-mi-sesion'] });
      qc.invalidateQueries({ queryKey: ['caja-sesiones'] });
      onOpenChange(false);
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      titulo="Apertura de caja"
      subtitulo={sucursalNombre ?? 'Iniciar sesión de caja'}
      icono={<Wallet className="size-5" />}
      variante="success"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="default"
            onClick={() => abrir.mutate()}
            disabled={!monto || abrir.isPending}
          >
            <Unlock className="size-4" /> Abrir caja
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-[hsl(var(--brand-success))]/30 bg-[hsl(var(--brand-success))]/8 px-4 py-3 text-xs leading-relaxed text-[hsl(var(--text-muted))]">
          El monto inicial es la cantidad de efectivo con la que arranca la caja. Servirá de
          referencia al cierre para calcular el monto esperado.
        </div>

        <div className="space-y-2">
          <Label htmlFor="apertura-monto">Monto inicial en soles (S/)</Label>
          <Input
            id="apertura-monto"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            className="text-lg font-mono"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apertura-monto-usd">
            Saldo inicial en dólares (US$) <span className="text-[hsl(var(--text-muted))]">— opcional</span>
          </Label>
          <Input
            id="apertura-monto-usd"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={montoUsd}
            onChange={e => setMontoUsd(e.target.value)}
            className="text-lg font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apertura-notas">Notas (opcional)</Label>
          <Textarea
            id="apertura-notas"
            rows={3}
            placeholder="Observaciones de apertura…"
            value={notas}
            onChange={e => setNotas(e.target.value)}
          />
        </div>
      </div>
    </DialogShell>
  );
}
