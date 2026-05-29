'use client';

import * as React from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConsultaDoc, type DatosRuc, type DatosDni } from './use-consulta-doc';

interface Props {
  /** Tipo de documento actual del formulario. El botón solo aparece para 'ruc' o 'dni'. */
  tipoDocumento: string;
  /** Valor del documento (con o sin formato; se limpia internamente). */
  documento: string;
  /** Callback con los datos SUNAT cuando se consulta un RUC. */
  onRuc?: (datos: DatosRuc) => void;
  /** Callback con los datos RENIEC cuando se consulta un DNI. */
  onDni?: (datos: DatosDni) => void;
  size?: 'sm' | 'default';
  className?: string;
  /** data-testid opcional para e2e. */
  testId?: string;
  /** Muestra el mensaje de estado (SUNAT · ACTIVO / error) debajo. Default true. */
  mostrarMensaje?: boolean;
}

/**
 * Botón reutilizable de consulta RUC (SUNAT) / DNI (RENIEC) vía json.pe.
 * Solo se renderiza si tipoDocumento es 'ruc' o 'dni'. Deshabilitado hasta
 * tener la longitud correcta (11 RUC / 8 DNI).
 */
export function BotonConsultaDoc({
  tipoDocumento,
  documento,
  onRuc,
  onDni,
  size = 'default',
  className,
  testId,
  mostrarMensaje = true,
}: Props) {
  const { estado, mensaje, consultarRuc, consultarDni } = useConsultaDoc();

  if (tipoDocumento !== 'ruc' && tipoDocumento !== 'dni') return null;

  const limpio = (documento ?? '').replace(/\D+/g, '');
  const longitudOk = tipoDocumento === 'ruc' ? limpio.length === 11 : limpio.length === 8;
  const label = tipoDocumento === 'ruc' ? 'SUNAT' : 'RENIEC';

  const ejecutar = async () => {
    if (tipoDocumento === 'ruc') {
      const d = await consultarRuc(limpio);
      if (d) onRuc?.(d);
    } else {
      const d = await consultarDni(limpio);
      if (d) onDni?.(d);
    }
  };

  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={ejecutar}
        disabled={estado === 'cargando' || !longitudOk}
        title={`Consultar ${label} vía json.pe`}
        data-testid={testId}
        className={cn('shrink-0', className)}
      >
        {estado === 'cargando' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : estado === 'ok' ? (
          <Check className="size-4 text-[hsl(var(--brand-success))]" />
        ) : (
          <Search className="size-4" />
        )}
        <span className="hidden sm:inline ml-1">{label}</span>
      </Button>
      {mostrarMensaje && mensaje && (
        <p
          className={cn(
            'text-[11px] mt-1',
            estado === 'ok' ? 'text-[hsl(var(--brand-success))]' : 'text-[hsl(355_75%_70%)]',
          )}
          role="status"
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
