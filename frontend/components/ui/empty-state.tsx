'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  ilustracion?: React.ReactNode;
  icono?: React.ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}

export function EmptyState({ ilustracion, icono, titulo, descripcion, accion, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-14',
        className,
      )}
    >
      {ilustracion ? (
        <div className="w-44 h-36 mb-2">{ilustracion}</div>
      ) : (
        <div className="size-14 mb-4 rounded-2xl bg-gradient-to-br from-[hsl(var(--brand-primary))]/15 to-[hsl(var(--brand-accent))]/15 grid place-items-center text-[hsl(var(--brand-primary))]">
          {icono ?? <span className="text-2xl">✦</span>}
        </div>
      )}
      <h3 className="text-base font-semibold mb-1.5">{titulo}</h3>
      {descripcion && (
        <p className="text-sm text-[hsl(var(--text-muted))] max-w-sm leading-relaxed">
          {descripcion}
        </p>
      )}
      {accion && (
        accion.href ? (
          <Button asChild className="mt-5" size="sm">
            <a href={accion.href}>{accion.label}</a>
          </Button>
        ) : (
          <Button onClick={accion.onClick} className="mt-5" size="sm">
            {accion.label}
          </Button>
        )
      )}
    </motion.div>
  );
}
