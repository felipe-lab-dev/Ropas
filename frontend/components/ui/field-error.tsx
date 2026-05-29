import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mensaje de error inline debajo de un campo de formulario.
 *
 * Regla universal: validación de formato (no solo "vacío") se muestra
 * en rojo, breve, debajo del input.
 *
 * Si `mensaje` es undefined/null/'' no renderiza nada.
 */
export function FieldError({ mensaje, className, id }: { mensaje?: string | null; className?: string; id?: string }) {
  if (!mensaje) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn('mt-1 text-xs text-[#ef4444] flex items-start gap-1', className)}
    >
      <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
      <span>{mensaje}</span>
    </p>
  );
}
