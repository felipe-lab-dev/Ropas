'use client';

import * as React from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTipoCambio } from './use-tipo-cambio';

export type FuenteTc = 'oficial' | 'manual';

interface Props {
  /** Fecha del comprobante (YYYY-MM-DD) usada para pedir el TC de ese día. */
  fecha: string;
  valor: number | null;
  fuente: FuenteTc;
  onCambio: (tc: number, fuente: FuenteTc) => void;
  testId?: string;
}

/**
 * Campo de tipo de cambio con autocompletado SUNAT (json.pe) y override manual.
 * - Al montar (o si cambia la fecha y el valor sigue siendo oficial) intenta
 *   traer el TC venta oficial. Nunca pisa un valor que el usuario tipeó a mano.
 * - Si json.pe falla, el campo queda editable y marca el valor como "manual".
 */
export function CampoTipoCambio({ fecha, valor, fuente, onCambio, testId }: Props) {
  const { estado, mensaje, consultar } = useTipoCambio();

  const obtenerOficial = React.useCallback(async () => {
    const datos = await consultar(fecha);
    if (datos) onCambio(datos.venta, 'oficial');
  }, [consultar, fecha, onCambio]);

  React.useEffect(() => {
    let activo = true;
    if (valor == null || fuente === 'oficial') {
      consultar(fecha).then(d => {
        if (activo && d) onCambio(d.venta, 'oficial');
      });
    }
    return () => {
      activo = false;
    };
    // Solo re-consultamos al cambiar la fecha; evitamos pisar un TC manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold">Tipo de cambio (venta) *</label>
      <div className="flex gap-2">
        <Input
          type="number"
          step={0.001}
          min={0}
          data-testid={testId}
          value={valor ?? ''}
          onChange={e => onCambio(Number(e.target.value), 'manual')}
          placeholder="3.756"
          className="h-10"
        />
        <Button
          type="button"
          variant="outline"
          onClick={obtenerOficial}
          disabled={estado === 'cargando'}
        >
          {estado === 'cargando' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : estado === 'ok' ? (
            <Check className="size-4" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          SUNAT
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {valor ? (
          fuente === 'oficial' ? (
            <Badge variant="success">TC SUNAT (oficial)</Badge>
          ) : (
            <Badge variant="warning">TC manual — verifica el valor</Badge>
          )
        ) : null}
        {mensaje && (
          <span role="status" className="text-xs text-[hsl(var(--text-muted))]">
            {mensaje}
          </span>
        )}
      </div>
    </div>
  );
}
