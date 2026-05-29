'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ANCHOS = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
} as const;

interface DetalleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título del header por defecto. */
  titulo?: React.ReactNode;
  /** Subtítulo del header por defecto. */
  subtitulo?: React.ReactNode;
  /** Ícono del header por defecto (dentro de un cuadro con gradiente). */
  icono?: React.ReactNode;
  /** Reemplaza el header por defecto por completo. */
  header?: React.ReactNode;
  /** Barra de acciones fija al pie del panel. */
  footer?: React.ReactNode;
  /** Ancho máximo en escritorio. Default `xl`. */
  ancho?: keyof typeof ANCHOS;
  children: React.ReactNode;
  /** Clase extra para el contenedor scrollable del cuerpo. */
  bodyClassName?: string;
}

/**
 * `true` desde ≥640px. Inicia en `true` para que el primer render en escritorio
 * no haga un flash de animación "desde abajo".
 */
function useEsEscritorio() {
  const [esEscritorio, setEsEscritorio] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => setEsEscritorio(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return esEscritorio;
}

/**
 * Drawer lateral reutilizable. En escritorio entra desde la derecha (alto completo);
 * en móvil es una hoja que sube desde abajo (respeta safe-areas).
 *
 * Se portaliza a `document.body` para escapar el stacking-context del shell
 * (el `<main>` anima con transform) y convivir con los diálogos Radix internos.
 */
export function DetalleSheet({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  icono,
  header,
  footer,
  ancho = 'xl',
  children,
  bodyClassName,
}: DetalleSheetProps) {
  const [montado, setMontado] = React.useState(false);
  const esEscritorio = useEsEscritorio();

  React.useEffect(() => setMontado(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previo;
    };
  }, [open, onOpenChange]);

  if (!montado) return null;

  const desliz = esEscritorio
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="contenedor-sheet fixed inset-0 z-50" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={() => onOpenChange(false)}
            className="no-print absolute inset-0 bg-[hsl(265_50%_4%)]/70 backdrop-blur-md"
          />
          <motion.aside
            data-detalle-sheet
            initial={desliz.initial}
            animate={desliz.animate}
            exit={desliz.exit}
            transition={{ type: 'spring', stiffness: 360, damping: 38 }}
            className={cn(
              'absolute flex flex-col overflow-hidden bg-[hsl(var(--surface))]',
              // móvil: hoja que sube desde abajo
              'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t border-[hsl(var(--border))] shadow-[0_-12px_48px_-12px_hsl(265_50%_4%/0.55)]',
              // escritorio: panel desde la derecha, alto completo
              'sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:h-full sm:w-full sm:max-h-none sm:rounded-none sm:border-t-0 sm:border-l sm:shadow-[-16px_0_56px_-16px_hsl(265_50%_4%/0.55)]',
              ANCHOS[ancho],
            )}
          >
            {/* asa (grip) visible solo en móvil */}
            <div className="no-print sm:hidden mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[hsl(var(--surface-2))]" />

            {header ?? (
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4 sm:pt-[max(1rem,env(safe-area-inset-top))]">
                <div className="flex min-w-0 items-start gap-3">
                  {icono && (
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg gradient-brand-accent text-white">
                      {icono}
                    </div>
                  )}
                  <div className="min-w-0">
                    {titulo && (
                      <h2 className="truncate text-lg font-bold tracking-tight">{titulo}</h2>
                    )}
                    {subtitulo && (
                      <p className="mt-0.5 truncate text-xs text-[hsl(var(--text-muted))]">
                        {subtitulo}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Cerrar"
                  className="no-print grid size-9 shrink-0 place-items-center rounded-lg text-[hsl(var(--text-muted))] transition-colors hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text))]"
                >
                  <X className="size-5" />
                </button>
              </div>
            )}

            <div className={cn('flex-1 overflow-y-auto overscroll-contain scrollbar-thin', bodyClassName)}>
              {children}
            </div>

            {footer && (
              <div
                className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 px-5 py-3"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                {footer}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
