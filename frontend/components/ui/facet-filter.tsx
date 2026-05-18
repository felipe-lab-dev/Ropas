'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OpcionFacet {
  valor: string;
  label: string;
  cantidad?: number;
  color?: string;
}

interface FacetFilterProps {
  titulo: string;
  opciones: OpcionFacet[];
  seleccionadas: string[];
  onCambiar: (seleccionadas: string[]) => void;
  multi?: boolean;
  className?: string;
}

export function FacetFilter({
  titulo,
  opciones,
  seleccionadas,
  onCambiar,
  multi = true,
  className,
}: FacetFilterProps) {
  const toggle = (valor: string) => {
    if (!multi) {
      onCambiar(seleccionadas.includes(valor) ? [] : [valor]);
      return;
    }
    onCambiar(
      seleccionadas.includes(valor)
        ? seleccionadas.filter(v => v !== valor)
        : [...seleccionadas, valor],
    );
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] uppercase tracking-wider font-bold text-[hsl(var(--text-muted))]">
          {titulo}
        </h4>
        {seleccionadas.length > 0 && (
          <button
            onClick={() => onCambiar([])}
            className="text-[10px] text-[hsl(var(--brand-primary))] hover:underline"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map(op => {
          const activo = seleccionadas.includes(op.valor);
          return (
            <motion.button
              key={op.valor}
              whileTap={{ scale: 0.96 }}
              onClick={() => toggle(op.valor)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                activo
                  ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--brand-primary))]'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--text-muted))] hover:border-[hsl(var(--brand-primary))]/40 hover:text-[hsl(var(--text))]',
              )}
            >
              {activo && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="inline-flex"
                >
                  <Check className="size-3" />
                </motion.span>
              )}
              {op.color && (
                <span
                  className="size-2.5 rounded-full ring-1 ring-[hsl(var(--border))]"
                  style={{ background: op.color }}
                />
              )}
              <span>{op.label}</span>
              {op.cantidad !== undefined && (
                <span className="tabular-nums opacity-60">{op.cantidad}</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
