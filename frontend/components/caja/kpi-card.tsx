'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatearMoneda } from '@/lib/utils';

type Tono = 'success' | 'info' | 'danger' | 'warning';

const TONOS: Record<
  Tono,
  { card: string; icon: string; label: string; iconBg: string }
> = {
  success: {
    card: 'from-[hsl(150_55%_42%)]/10 to-transparent border-[hsl(150_55%_42%)]/25',
    icon: 'text-[hsl(150_55%_60%)]',
    iconBg: 'bg-[hsl(150_55%_42%)]/20',
    label: 'text-[hsl(150_55%_60%)]',
  },
  info: {
    card: 'from-[hsl(var(--brand-primary))]/12 to-transparent border-[hsl(var(--brand-primary))]/25',
    icon: 'text-[hsl(var(--brand-accent))]',
    iconBg: 'bg-[hsl(var(--brand-primary))]/20',
    label: 'text-[hsl(var(--brand-accent))]',
  },
  danger: {
    card: 'from-[hsl(355_75%_55%)]/10 to-transparent border-[hsl(355_75%_55%)]/25',
    icon: 'text-[hsl(355_85%_70%)]',
    iconBg: 'bg-[hsl(355_75%_55%)]/20',
    label: 'text-[hsl(355_85%_70%)]',
  },
  warning: {
    card: 'from-[hsl(35_90%_55%)]/10 to-transparent border-[hsl(35_90%_55%)]/25',
    icon: 'text-[hsl(35_90%_65%)]',
    iconBg: 'bg-[hsl(35_90%_55%)]/20',
    label: 'text-[hsl(35_90%_65%)]',
  },
};

interface KpiCardProps {
  titulo: string;
  monto: number | string;
  detalle?: string;
  icono: React.ReactNode;
  tono?: Tono;
  delay?: number;
  className?: string;
}

export function KpiCard({
  titulo,
  monto,
  detalle,
  icono,
  tono = 'info',
  delay = 0,
  className,
}: KpiCardProps) {
  const t = TONOS[tono];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-gradient-to-br p-5',
        t.card,
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            'size-10 rounded-lg grid place-items-center shadow-md',
            t.iconBg,
            t.icon,
          )}
        >
          {icono}
        </div>
      </div>
      <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1', t.label)}>
        {titulo}
      </p>
      <p className="text-2xl font-bold tabular-nums">{formatearMoneda(monto)}</p>
      {detalle && (
        <p className="text-[11px] text-[hsl(var(--text-muted))] mt-2 pt-2 border-t border-[hsl(var(--border))]/50">
          {detalle}
        </p>
      )}
    </motion.div>
  );
}
