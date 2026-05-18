'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

interface IlustracionProps {
  className?: string;
}

/**
 * Ilustraciones SVG con animaciones sutiles. Usan los CSS vars de marca
 * para integrarse con la paleta activa.
 */

export function IlustracionProductos({ className }: IlustracionProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none">
      <defs>
        <linearGradient id="prodGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand-primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--brand-accent))" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <motion.rect
        initial={{ y: 4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        x="40" y="50" width="120" height="90"
        rx="14"
        fill="url(#prodGrad)"
        stroke="hsl(var(--brand-primary))"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        d="M70 50 L70 30 Q70 20 80 20 L120 20 Q130 20 130 30 L130 50"
        stroke="hsl(var(--brand-primary))"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <motion.circle
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
        cx="100" cy="95" r="22"
        fill="hsl(var(--brand-accent))"
        opacity="0.18"
      />
      <motion.text
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        x="100" y="103"
        textAnchor="middle"
        fill="hsl(var(--brand-primary))"
        fontSize="22"
        fontWeight="700"
      >+</motion.text>
    </svg>
  );
}

export function IlustracionVentas({ className }: IlustracionProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none">
      <defs>
        <linearGradient id="venGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="hsl(var(--brand-primary))" stopOpacity="0.05" />
          <stop offset="100%" stopColor="hsl(var(--brand-primary))" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <motion.path
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.1 }}
        d="M 20 120 L 60 90 L 90 100 L 130 60 L 180 40"
        stroke="hsl(var(--brand-primary))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <motion.path
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.9 }}
        d="M 20 120 L 60 90 L 90 100 L 130 60 L 180 40 L 180 140 L 20 140 Z"
        fill="url(#venGrad)"
      />
      {[
        { x: 60, y: 90 }, { x: 90, y: 100 }, { x: 130, y: 60 }, { x: 180, y: 40 },
      ].map((p, i) => (
        <motion.circle
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.0 + i * 0.08, type: 'spring' }}
          cx={p.x} cy={p.y} r="4"
          fill="hsl(var(--brand-accent))"
          stroke="hsl(var(--surface))"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

export function IlustracionClientes({ className }: IlustracionProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none">
      <motion.g
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <circle cx="100" cy="65" r="22" fill="hsl(var(--brand-primary) / 0.2)" stroke="hsl(var(--brand-primary))" strokeWidth="1.5" />
        <path d="M70 130 Q70 100 100 100 Q130 100 130 130" stroke="hsl(var(--brand-primary))" strokeWidth="1.5" fill="hsl(var(--brand-primary) / 0.1)" />
      </motion.g>
      {[
        { cx: 50, cy: 80, delay: 0.2 },
        { cx: 150, cy: 80, delay: 0.35 },
      ].map((p, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: p.delay }}
        >
          <circle cx={p.cx} cy={p.cy} r="14" fill="hsl(var(--brand-accent) / 0.18)" stroke="hsl(var(--brand-accent))" strokeWidth="1.2" />
          <path d={`M${p.cx - 18} 130 Q${p.cx - 18} 110 ${p.cx} 110 Q${p.cx + 18} 110 ${p.cx + 18} 130`} stroke="hsl(var(--brand-accent))" strokeWidth="1.2" fill="hsl(var(--brand-accent) / 0.08)" />
        </motion.g>
      ))}
    </svg>
  );
}

export function IlustracionInventario({ className }: IlustracionProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none">
      {[
        { x: 30, y: 60, delay: 0 },
        { x: 80, y: 40, delay: 0.1 },
        { x: 130, y: 60, delay: 0.2 },
        { x: 55, y: 100, delay: 0.3 },
        { x: 105, y: 100, delay: 0.4 },
      ].map((b, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: b.delay }}
        >
          <rect
            x={b.x} y={b.y} width="42" height="38" rx="6"
            fill={i % 2 === 0 ? 'hsl(var(--brand-primary) / 0.2)' : 'hsl(var(--brand-accent) / 0.2)'}
            stroke={i % 2 === 0 ? 'hsl(var(--brand-primary))' : 'hsl(var(--brand-accent))'}
            strokeWidth="1.5"
          />
          <line x1={b.x + 8} y1={b.y + 12} x2={b.x + 34} y2={b.y + 12}
            stroke={i % 2 === 0 ? 'hsl(var(--brand-primary))' : 'hsl(var(--brand-accent))'}
            strokeWidth="1.2" opacity="0.6" />
          <line x1={b.x + 8} y1={b.y + 20} x2={b.x + 26} y2={b.y + 20}
            stroke={i % 2 === 0 ? 'hsl(var(--brand-primary))' : 'hsl(var(--brand-accent))'}
            strokeWidth="1.2" opacity="0.4" />
        </motion.g>
      ))}
    </svg>
  );
}

export function IlustracionGenerica({ className }: IlustracionProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none">
      <motion.circle
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.1 }}
        cx="100" cy="80" r="40"
        fill="hsl(var(--brand-primary) / 0.18)"
        stroke="hsl(var(--brand-primary))"
        strokeWidth="1.5"
        strokeDasharray="6 6"
      />
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        d="M85 75 Q100 60 115 75 M85 92 Q100 100 115 92"
        stroke="hsl(var(--brand-primary))"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
