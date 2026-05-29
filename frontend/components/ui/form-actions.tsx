'use client';

import * as React from 'react';
import { Save, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FormActionsProps {
  /** Texto del botón primario. Default: "Guardar cambios" */
  textoGuardar?: string;
  onGuardar: () => void;
  guardando?: boolean;

  /** Si pasa, renderiza botón Cancelar a la izquierda. */
  onCancelar?: () => void;
  textoCancelar?: string;

  /** Si pasa, renderiza botón Eliminar (rojo) junto a Cancelar. */
  onEliminar?: () => void;
  eliminando?: boolean;
  textoEliminar?: string;

  /** Forma del bar: 'inline' (default) o 'sticky' (bottom-bar pegado). */
  variante?: 'inline' | 'sticky';

  /** className extra */
  className?: string;
}

/**
 * Barra de acciones estándar para formularios de edición / creación.
 *
 * Regla universal (CLAUDE.md):
 *  - Orden: [Cancelar] [Eliminar] ··· [Guardar]
 *  - Eliminar siempre dispara un Dialog de confirmación afuera de este componente
 *    (pasá `onEliminar` que abra tu `<DeleteConfirmDialog>`).
 *  - Botones deshabilitados durante mutaciones.
 *  - Sin doble-click: el `disabled` previene re-disparos.
 *
 * Uso:
 *   <FormActions
 *     onGuardar={() => mutar.mutate()}
 *     guardando={mutar.isPending}
 *     onEliminar={() => setConfirmAbierto(true)}
 *     onCancelar={() => router.back()}
 *   />
 */
export function FormActions({
  textoGuardar = 'Guardar cambios',
  onGuardar,
  guardando = false,
  onCancelar,
  textoCancelar = 'Cancelar',
  onEliminar,
  eliminando = false,
  textoEliminar = 'Eliminar',
  variante = 'inline',
  className,
}: FormActionsProps) {
  return (
    <div
      data-testid="form-actions"
      className={cn(
        'flex items-center gap-2 flex-wrap',
        variante === 'sticky' &&
          'sticky bottom-0 -mx-4 px-4 py-3 bg-[hsl(var(--surface))] border-t border-[hsl(var(--border))] z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]',
        className,
      )}
    >
      {onCancelar && (
        <Button
          type="button"
          variant="ghost"
          onClick={onCancelar}
          disabled={guardando || eliminando}
          data-testid="btn-cancelar"
        >
          <X className="size-4" />
          {textoCancelar}
        </Button>
      )}

      {onEliminar && (
        <Button
          type="button"
          variant="outline"
          onClick={onEliminar}
          disabled={guardando || eliminando}
          data-testid="btn-eliminar"
          className="border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10 hover:text-[#ef4444]"
        >
          <Trash2 className="size-4" />
          {textoEliminar}
        </Button>
      )}

      <div className="ml-auto">
        <Button
          type="button"
          onClick={onGuardar}
          disabled={guardando || eliminando}
          data-testid="btn-guardar"
        >
          {guardando ? (
            <><Loader2 className="size-4 animate-spin" /> Guardando…</>
          ) : (
            <><Save className="size-4" /> {textoGuardar}</>
          )}
        </Button>
      </div>
    </div>
  );
}
