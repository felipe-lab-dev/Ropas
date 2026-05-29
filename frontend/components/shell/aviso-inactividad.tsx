'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInactividad, formatearRestante } from '@/lib/use-inactividad';

export function AvisoInactividad() {
  const { avisar, restanteMs, reiniciar } = useInactividad();

  return (
    <Dialog open={avisar} onOpenChange={open => { if (!open) reiniciar(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tu sesión está por cerrarse</DialogTitle>
          <DialogDescription>
            Llevas 29 minutos sin actividad. Vamos a cerrar la sesión en{' '}
            <span className="font-mono font-semibold text-[hsl(var(--brand-danger))]">
              {formatearRestante(restanteMs)}
            </span>
            . Tocá el botón para seguir conectado.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={reiniciar} className="w-full">Seguir conectado</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
