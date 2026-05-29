'use client';

import * as React from 'react';
import { toast } from 'sonner';

export interface ReglaCampo<T> {
  /** Identificador único del campo (típicamente la prop del estado). */
  id: string;
  /** Label legible para mostrar en el toast: "Nombre", "Categoría", "RUC". */
  label: string;
  /** Función que retorna error string si inválido, null si OK. */
  validar: (datos: T) => string | null;
  /** ID de la tab (si el form está en tabs) donde vive este campo. */
  tabId?: string;
  /** Selector CSS opcional para hacer scroll + focus al elemento que rompe. */
  selectorFoco?: string;
}

export interface ResultadoValidacion {
  valido: boolean;
  errores: Record<string, string>;
  primerErrorId: string | null;
  primerErrorTabId: string | null;
}

interface OpcionesUso<T> {
  reglas: ReglaCampo<T>[];
  /** Si pasás setter de tab, al fallar valida el primer error abre su tab. */
  onAbrirTab?: (tabId: string) => void;
}

/**
 * Hook universal de validación de formularios.
 *
 * Cumple con la regla universal (CLAUDE.md):
 *  - Valida al click de Guardar.
 *  - Toast de error con lista de campos faltantes.
 *  - Marca errores por campo (para que el FormField muestre borde rojo).
 *  - Hace scroll + focus al primer campo con error.
 *  - Abre la tab del primer error si el form usa tabs.
 *
 * Uso:
 *   const validacion = useValidacionForm<MiForm>({
 *     reglas: [
 *       { id: 'nombre', label: 'Nombre', validar: d => d.nombre.trim() ? null : 'Campo vacío', tabId: 'general' },
 *       { id: 'categoriaId', label: 'Categoría', validar: d => d.categoriaId ? null : 'Seleccionar categoría', tabId: 'general' },
 *     ],
 *     onAbrirTab: setTab,
 *   });
 *
 *   const onGuardar = () => {
 *     const r = validacion.validar(estadoActual);
 *     if (!r.valido) return;
 *     mutar.mutate(estadoActual);
 *   };
 *
 *   <FormField label="Nombre" htmlFor="nombre" requerido error={validacion.errores.nombre}>
 *     <Input id="nombre" value={...} onChange={(e) => { setNombre(e.target.value); validacion.limpiarError('nombre'); }} />
 *   </FormField>
 */
export function useValidacionForm<T>({ reglas, onAbrirTab }: OpcionesUso<T>) {
  const [errores, setErrores] = React.useState<Record<string, string>>({});

  const validar = React.useCallback((datos: T): ResultadoValidacion => {
    const nuevosErrores: Record<string, string> = {};
    const faltantes: string[] = [];
    let primerErrorId: string | null = null;
    let primerErrorTabId: string | null = null;
    let primerSelector: string | undefined;

    for (const regla of reglas) {
      const error = regla.validar(datos);
      if (error) {
        nuevosErrores[regla.id] = error;
        faltantes.push(regla.label);
        if (primerErrorId === null) {
          primerErrorId = regla.id;
          primerErrorTabId = regla.tabId ?? null;
          primerSelector = regla.selectorFoco;
        }
      }
    }

    setErrores(nuevosErrores);

    if (faltantes.length > 0) {
      let mensaje: string;
      if (faltantes.length === 1) {
        // Un solo error: mostrar mensaje específico del validar()
        const primerId = primerErrorId!;
        const detalle = nuevosErrores[primerId];
        mensaje = `${faltantes[0]}: ${detalle ?? 'requerido'}`;
      } else {
        const lista = faltantes.length <= 3
          ? faltantes.join(', ')
          : `${faltantes.slice(0, 3).join(', ')} y ${faltantes.length - 3} más`;
        mensaje = `Faltan: ${lista}`;
      }
      toast.error(mensaje);

      if (primerErrorTabId && onAbrirTab) {
        onAbrirTab(primerErrorTabId);
      }

      const selector = primerSelector ?? (primerErrorId ? `#${primerErrorId}` : undefined);
      if (selector && typeof document !== 'undefined') {
        // Esperar un tick para que la tab se monte si se cambió
        setTimeout(() => {
          const el = document.querySelector<HTMLElement>(selector);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (el as HTMLInputElement).focus?.();
          }
        }, 80);
      }
    }

    return {
      valido: faltantes.length === 0,
      errores: nuevosErrores,
      primerErrorId,
      primerErrorTabId,
    };
  }, [reglas, onAbrirTab]);

  const limpiarError = React.useCallback((id: string) => {
    setErrores(prev => {
      if (!(id in prev)) return prev;
      const { [id]: _quitado, ...resto } = prev;
      return resto;
    });
  }, []);

  const limpiarTodo = React.useCallback(() => setErrores({}), []);

  return { errores, validar, limpiarError, limpiarTodo };
}
