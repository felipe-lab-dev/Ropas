'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  className?: string;
}

export function PageHeader({ titulo, descripcion, acciones, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn('flex flex-wrap items-end justify-between gap-4 mb-8', className)}
    >
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-[hsl(var(--text))] to-[hsl(var(--text))]/70 bg-clip-text">
          {titulo}
        </h1>
        {descripcion && (
          <p className="text-sm text-[hsl(var(--text-muted))] mt-1.5">{descripcion}</p>
        )}
      </div>
      {acciones && <div className="flex items-center gap-2 shrink-0">{acciones}</div>}
    </motion.div>
  );
}
