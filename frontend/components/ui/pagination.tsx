'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  pagina: number;
  totalPaginas: number;
  total: number;
  limite: number;
  onCambiar: (pagina: number) => void;
  className?: string;
}

export function Pagination({
  pagina,
  totalPaginas,
  total,
  limite,
  onCambiar,
  className,
}: PaginationProps) {
  if (totalPaginas <= 1 && total === 0) return null;

  const desde = total === 0 ? 0 : (pagina - 1) * limite + 1;
  const hasta = Math.min(pagina * limite, total);

  const numeros = construirRango(pagina, totalPaginas);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/30',
        className,
      )}
    >
      <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums">
        Mostrando <span className="font-semibold text-[hsl(var(--text))]">{desde.toLocaleString('es-PE')}</span>–
        <span className="font-semibold text-[hsl(var(--text))]">{hasta.toLocaleString('es-PE')}</span> de{' '}
        <span className="font-semibold text-[hsl(var(--text))]">{total.toLocaleString('es-PE')}</span>
      </span>

      <div className="flex items-center gap-1">
        <BotonPagina
          onClick={() => onCambiar(1)}
          disabled={pagina <= 1}
          aria-label="Primera página"
        >
          <ChevronsLeft className="size-3.5" />
        </BotonPagina>
        <BotonPagina
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-3.5" />
        </BotonPagina>

        {numeros.map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-[hsl(var(--text-muted))]">…</span>
          ) : (
            <BotonPagina
              key={n}
              activo={n === pagina}
              onClick={() => onCambiar(n)}
              aria-label={`Ir a página ${n}`}
            >
              {n}
            </BotonPagina>
          ),
        )}

        <BotonPagina
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-3.5" />
        </BotonPagina>
        <BotonPagina
          onClick={() => onCambiar(totalPaginas)}
          disabled={pagina >= totalPaginas}
          aria-label="Última página"
        >
          <ChevronsRight className="size-3.5" />
        </BotonPagina>
      </div>
    </motion.div>
  );
}

interface BotonPaginaProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  activo?: boolean;
}

function BotonPagina({ activo, className, children, ...props }: BotonPaginaProps) {
  return (
    <button
      type="button"
      className={cn(
        'min-w-[30px] h-8 px-2 rounded-md text-xs font-medium tabular-nums transition-all grid place-items-center',
        activo
          ? 'bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))] text-white shadow-[0_2px_8px_hsl(var(--brand-primary)/0.35)]'
          : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text))]',
        'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function construirRango(pagina: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (pagina <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (pagina >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', pagina - 1, pagina, pagina + 1, '…', total];
}
