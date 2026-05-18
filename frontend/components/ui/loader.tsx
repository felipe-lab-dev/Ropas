'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  texto?: string;
}

const tamanos = {
  sm: 'size-4 border-[2px]',
  md: 'size-6 border-[2.5px]',
  lg: 'size-10 border-[3px]',
};

export function Spinner({ size = 'md', className }: LoaderProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full border-[hsl(var(--brand-primary))] border-t-transparent animate-spin',
        tamanos[size],
        className,
      )}
      aria-label="Cargando"
    />
  );
}

export function Dots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label="Cargando">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-[hsl(var(--brand-primary))]"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.12,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}

export function PageLoader({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="relative">
        <div className="size-16 rounded-2xl gradient-brand-accent opacity-20 animate-pulse-glow" />
        <div className="absolute inset-0 grid place-items-center">
          <Spinner size="lg" className="border-white/0 border-t-white" />
        </div>
      </div>
      <div className="text-sm text-[hsl(var(--text-muted))] flex items-center gap-2">
        {texto} <Dots />
      </div>
    </div>
  );
}
