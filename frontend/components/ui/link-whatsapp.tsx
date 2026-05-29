'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  telefono: string | null | undefined;
  /** Texto visible. Por defecto el propio teléfono. */
  children?: React.ReactNode;
  /** Solo mostrar el ícono (sin texto). */
  soloIcono?: boolean;
  className?: string;
  /** Tamaño del ícono (clase tailwind). Default `size-3.5`. */
  iconClassName?: string;
}

/**
 * Teléfono con logo de WhatsApp clickeable.
 * Regla global Felipe:
 *  - 9 dígitos PE  → se antepone "51" en la URL wa.me
 *  - ≥11 dígitos o trae "+" → asume código país incluido
 *  - Click sobre logo O número abre wa.me en pestaña nueva
 */
export function LinkWhatsApp({
  telefono,
  children,
  soloIcono = false,
  className,
  iconClassName = 'size-3.5',
}: Props) {
  if (!telefono) return <span className="text-[hsl(var(--text-muted))]">—</span>;

  const limpio = telefono.replace(/\D+/g, '');
  if (limpio.length === 0) return <span className="text-[hsl(var(--text-muted))]">—</span>;

  const conPais =
    telefono.trim().startsWith('+') || limpio.length >= 11
      ? limpio
      : limpio.length === 9
        ? `51${limpio}`
        : limpio;

  const href = `https://wa.me/${conPais}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      onClick={e => e.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-1.5 text-current hover:text-[#25D366] transition-colors',
        className,
      )}
      title={`Abrir WhatsApp con ${telefono}`}
    >
      <LogoWhatsApp className={iconClassName} />
      {!soloIcono && <span className="tabular-nums">{children ?? telefono}</span>}
    </a>
  );
}

function LogoWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-label="WhatsApp"
      role="img"
    >
      <path
        fill="#25D366"
        d="M16 .5C7.44.5.5 7.44.5 16c0 2.83.74 5.58 2.15 8.01L.5 31.5l7.7-2.02A15.46 15.46 0 0 0 16 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5Z"
      />
      <path
        fill="#fff"
        d="M23.32 19.07c-.4-.2-2.34-1.15-2.7-1.28-.36-.13-.62-.2-.88.2-.26.39-1.02 1.28-1.25 1.54-.23.26-.46.3-.86.1-.4-.2-1.68-.62-3.2-1.97a12.05 12.05 0 0 1-2.22-2.77c-.23-.4-.02-.61.18-.81.18-.18.4-.46.6-.69.2-.23.27-.4.4-.66.13-.27.07-.5-.03-.7-.1-.2-.88-2.12-1.21-2.91-.32-.76-.65-.66-.88-.67-.23-.01-.5-.01-.76-.01-.26 0-.7.1-1.06.5-.36.4-1.39 1.36-1.39 3.32 0 1.96 1.42 3.85 1.62 4.11.2.27 2.8 4.27 6.78 5.99.95.41 1.69.65 2.27.84.95.3 1.82.26 2.5.16.76-.11 2.34-.96 2.67-1.88.33-.92.33-1.71.23-1.88-.1-.17-.36-.27-.76-.47Z"
      />
    </svg>
  );
}
