'use client';

import * as React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowDownCircle,
} from 'lucide-react';
import type { EstadoSunat } from '@/lib/api/hooks/use-documento-electronico';

// ─── Configuración por estado ─────────────────────────────────────────────────

const ESTILOS: Record<EstadoSunat, string> = {
  pendiente:
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  en_proceso:
    'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  aceptado:
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  aceptado_observado:
    'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  rechazado:
    'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  anulado:
    'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
  baja_pendiente:
    'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
};

const ETIQUETAS: Record<EstadoSunat, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  aceptado: 'Aceptado',
  aceptado_observado: 'Aceptado con obs.',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
  baja_pendiente: 'Baja pendiente',
};

type IconComponent = React.ComponentType<{ className?: string }>;

const ICONOS: Record<EstadoSunat, IconComponent> = {
  pendiente: Clock,
  en_proceso: Loader2,
  aceptado: CheckCircle2,
  aceptado_observado: AlertTriangle,
  rechazado: XCircle,
  anulado: AlertCircle,
  baja_pendiente: ArrowDownCircle,
};

// ─── Componente ───────────────────────────────────────────────────────────────

interface EstadoCpeBadgeProps {
  estado: EstadoSunat;
  size?: 'sm' | 'md';
}

export function EstadoCpeBadge({ estado, size = 'md' }: EstadoCpeBadgeProps) {
  const Icono = ICONOS[estado];
  const esEnProceso = estado === 'en_proceso';

  const iconSize = size === 'sm' ? 'size-3' : 'size-3.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs font-medium';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border',
        padding,
        textSize,
        ESTILOS[estado],
      ].join(' ')}
      data-testid="estado-cpe-badge"
      data-estado={estado}
    >
      <Icono
        className={[
          iconSize,
          'shrink-0',
          esEnProceso ? 'animate-spin' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
      {ETIQUETAS[estado]}
    </span>
  );
}
