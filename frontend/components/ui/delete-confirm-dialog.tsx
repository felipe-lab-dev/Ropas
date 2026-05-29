'use client';

import * as React from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteConfirmDialogProps {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
  /** Texto del título: "Eliminar producto", "Eliminar cliente"... */
  titulo: string;
  /** Detalle opcional. Si no se pasa, mensaje genérico. */
  descripcion?: React.ReactNode;
  /** Texto en negrita (nombre del item a borrar): "Abrigo Valentina" */
  nombreItem?: string;
  onConfirmar: () => void | Promise<void>;
  eliminando?: boolean;
  /** Texto del botón de confirmación. Default: "Sí, eliminar" */
  textoConfirmar?: string;
}

/**
 * Diálogo de confirmación de borrado estándar.
 *
 * Regla universal (CLAUDE.md): TODO botón Eliminar debe abrir este diálogo
 * antes de borrar. Botón confirmatorio en rojo, claro qué se va a borrar.
 *
 * Uso:
 *   const [abierto, setAbierto] = React.useState(false);
 *   <Button variant="destructive" onClick={() => setAbierto(true)}>Eliminar</Button>
 *   <DeleteConfirmDialog
 *     abierto={abierto}
 *     onAbiertoChange={setAbierto}
 *     titulo="Eliminar producto"
 *     nombreItem={producto.nombre}
 *     onConfirmar={() => borrar.mutate(producto.id)}
 *     eliminando={borrar.isPending}
 *   />
 */
export function DeleteConfirmDialog({
  abierto,
  onAbiertoChange,
  titulo,
  descripcion,
  nombreItem,
  onConfirmar,
  eliminando = false,
  textoConfirmar = 'Sí, eliminar',
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !eliminando && onAbiertoChange(v)}>
      <DialogContent
        data-testid="delete-confirm-dialog"
        className="max-w-md"
        onEscapeKeyDown={(e) => { if (eliminando) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-[#ef4444]" />
            {titulo}
          </DialogTitle>
          <DialogDescription>
            {descripcion ?? (
              <>
                Esta acción no se puede deshacer.
                {nombreItem && (
                  <>
                    {' '}Se eliminará <strong className="text-[hsl(var(--text))]">{nombreItem}</strong>.
                  </>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onAbiertoChange(false)}
            disabled={eliminando}
            data-testid="btn-cancelar-eliminar"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirmar()}
            disabled={eliminando}
            data-testid="btn-confirmar-eliminar"
            className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
          >
            {eliminando ? (
              <><Loader2 className="size-4 animate-spin" /> Eliminando…</>
            ) : (
              <><Trash2 className="size-4" /> {textoConfirmar}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
