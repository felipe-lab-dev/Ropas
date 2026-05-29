import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Asterisco rojo para campos obligatorios.
 *
 * Regla universal (CLAUDE.md): todo `*` que marca "required" debe ser
 * visualmente rojo en TODOS los proyectos. Usalo SIEMPRE — nunca pongas
 * un asterisco a mano con clase distinta.
 *
 * Uso:
 *   <Label>Nombre <RequiredMark /></Label>
 *
 * Renderiza un `<span>` con color rojo. `aria-label="requerido"` para
 * accesibilidad sin ruido visual extra.
 */
export function RequiredMark({ className }: { className?: string }) {
  return (
    <span
      aria-label="requerido"
      className={cn('ml-0.5 text-[#ef4444] font-semibold select-none', className)}
    >
      *
    </span>
  );
}
