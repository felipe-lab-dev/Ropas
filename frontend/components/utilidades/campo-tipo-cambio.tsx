'use client';

import * as React from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTipoCambio } from './use-tipo-cambio';

export type FuenteTc = 'oficial' | 'manual';

/** Convierte una fecha ISO (YYYY-MM-DD) a día-mes-año (DD-MM-YYYY). */
function aDdMmYyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

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
 * - Al montar (o si cambia la fecha y el valor sigue siendo oficial) trae el TC
 *   venta oficial EN SILENCIO. Nunca pisa un valor que el usuario tipeó a mano.
 * - Si json.pe falla, el campo queda editable como "manual" (no bloquea la compra).
 *
 * No hay botón "SUNAT": el valor se autocompleta solo. Si el usuario lo edita a
 * mano, ofrecemos un enlace discreto para volver al oficial.
 */
export function CampoTipoCambio({ fecha, valor, fuente, onCambio, testId }: Props) {
  const { estado, mensaje, consultar } = useTipoCambio();
  // Último TC oficial conocido para la fecha: permite "volver al oficial"
  // después de una edición manual sin re-disparar la consulta.
  const [oficial, setOficial] = React.useState<{ venta: number; fecha: string } | null>(null);

  React.useEffect(() => {
    let activo = true;
    consultar(fecha, { silenciar: true }).then(d => {
      if (!activo || !d) return;
      setOficial({ venta: d.venta, fecha: d.fecha });
      // Solo autocompletamos si el usuario no fijó un valor manual.
      if (valor == null || fuente === 'oficial') onCambio(d.venta, 'oficial');
    });
    return () => {
      activo = false;
    };
    // Re-consultamos solo al cambiar la fecha; evitamos pisar un TC manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const usarOficial = () => {
    if (oficial) onCambio(oficial.venta, 'oficial');
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold">Tipo de cambio (venta) *</label>
      <Input
        type="number"
        step={0.001}
        min={0}
        data-testid={testId}
        value={valor ?? ''}
        onChange={e => onCambio(Number(e.target.value), 'manual')}
        placeholder="3.756"
        className="h-10 tabular-nums"
      />
      <p
        role="status"
        className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--text-muted))]"
      >
        {estado === 'cargando' ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Consultando SUNAT…
          </>
        ) : valor && fuente === 'oficial' ? (
          <>
            <ShieldCheck className="size-3 text-[hsl(var(--brand-success,142_71%_45%))]" />
            Oficial SUNAT{oficial ? ` · ${aDdMmYyyy(oficial.fecha)}` : ''}
          </>
        ) : valor && fuente === 'manual' ? (
          <>
            <span className="text-[hsl(var(--brand-warning,38_92%_50%))]">Manual — verificá el valor</span>
            {oficial && Math.abs(oficial.venta - valor) > 1e-4 && (
              <button
                type="button"
                onClick={usarOficial}
                className="underline underline-offset-2 hover:text-[hsl(var(--text))]"
              >
                usar oficial {oficial.venta.toFixed(3)}
              </button>
            )}
          </>
        ) : (
          mensaje ?? 'Ingresá el tipo de cambio del día'
        )}
      </p>
    </div>
  );
}
