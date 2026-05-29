'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { obtener, mensajeError } from '@/lib/api/client';

/**
 * Hook para consultar el tipo de cambio oficial (SUNAT) vía json.pe.
 * Reusa el backend `GET /utilidades/tipo-cambio?fecha=YYYY-MM-DD`.
 * Si json.pe falla, el llamador puede seguir con un TC manual (no bloquea).
 */

export interface DatosTipoCambio {
  venta: number;
  compra: number;
  moneda: string;
  fecha: string;
}

export type EstadoTc = 'idle' | 'cargando' | 'ok' | 'error';

export function useTipoCambio() {
  const [estado, setEstado] = React.useState<EstadoTc>('idle');
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  const consultar = React.useCallback(
    async (
      fecha?: string,
      opts: { silenciar?: boolean } = {},
    ): Promise<DatosTipoCambio | null> => {
      setEstado('cargando');
      setMensaje(null);
      try {
        const qs = fecha ? `?fecha=${fecha}` : '';
        const datos = await obtener<DatosTipoCambio>(`/utilidades/tipo-cambio${qs}`);
        setEstado('ok');
        setMensaje(`SUNAT · venta ${datos.venta.toFixed(3)} · ${datos.fecha}`);
        return datos;
      } catch (err) {
        const m = mensajeError(err);
        setEstado('error');
        setMensaje(m);
        if (!opts.silenciar) toast.error(`No se pudo obtener el TC: ${m}`);
        return null;
      }
    },
    [],
  );

  return { estado, mensaje, consultar };
}
