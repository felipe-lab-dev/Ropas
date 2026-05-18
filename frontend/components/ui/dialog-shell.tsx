'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogOverlay,
} from './dialog';
import { cn } from '@/lib/utils';

interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  icono?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tamano?: 'sm' | 'md' | 'lg' | 'xl';
  variante?: 'brand' | 'danger' | 'success' | 'neutro';
}

const TAMANOS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const VARIANTES = {
  brand: 'from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))]',
  danger: 'from-[hsl(var(--brand-danger))] to-[hsl(355_70%_42%)]',
  success: 'from-[hsl(var(--brand-success))] to-[hsl(150_55%_32%)]',
  neutro: 'from-[hsl(265_25%_22%)] to-[hsl(265_30%_14%)]',
};

export function DialogShell({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  icono,
  children,
  footer,
  tamano = 'md',
  variante = 'brand',
}: DialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full',
            'border border-[hsl(var(--border))] bg-[hsl(var(--surface))] rounded-2xl overflow-hidden',
            'shadow-[0_28px_64px_-12px_hsl(265_50%_4%/0.55)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]',
            TAMANOS[tamano],
          )}
        >
          {/* Header con gradient */}
          <div className={cn('px-6 py-4 bg-gradient-to-br text-white flex items-start justify-between gap-4 relative overflow-hidden', VARIANTES[variante])}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_120%,rgba(255,255,255,0.18),transparent_60%)] pointer-events-none" />
            <div className="relative flex items-start gap-3 min-w-0">
              {icono && (
                <div className="size-10 rounded-lg bg-white/15 backdrop-blur grid place-items-center shrink-0 mt-0.5">
                  {icono}
                </div>
              )}
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-lg font-bold leading-tight tracking-tight truncate">
                  {titulo}
                </DialogPrimitive.Title>
                {subtitulo && (
                  <DialogPrimitive.Description className="text-xs text-white/70 mt-1 truncate">
                    {subtitulo}
                  </DialogPrimitive.Description>
                )}
              </div>
            </div>
            <DialogPrimitive.Close
              aria-label="Cerrar"
              className="relative size-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body scroll */}
          <div className="max-h-[min(70vh,640px)] overflow-y-auto scrollbar-thin p-6">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-3.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 flex flex-wrap justify-end gap-2">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// Re-exports para compat con código existente
export { Dialog, DialogContent };
