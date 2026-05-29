'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, Lock, ShoppingBag, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabDef {
  key: string;
  label: string;
  href: string;
  icono: React.ReactNode;
  matchPath: (path: string) => boolean;
}

const TABS: TabDef[] = [
  {
    key: 'hoy',
    label: 'Caja de hoy',
    href: '/caja',
    icono: <Wallet className="size-3.5" />,
    matchPath: p => p === '/caja',
  },
  {
    key: 'cierres',
    label: 'Cierres',
    href: '/caja/historial',
    icono: <Lock className="size-3.5" />,
    matchPath: p => p.startsWith('/caja/historial'),
  },
  {
    key: 'ventas-dia',
    label: 'Ventas del día',
    href: '/ventas?desde=hoy',
    icono: <ShoppingBag className="size-3.5" />,
    matchPath: p => p === '/ventas',
  },
  {
    key: 'notas-credito',
    label: 'Notas de crédito',
    href: '/notas-credito',
    icono: <Undo2 className="size-3.5" />,
    matchPath: p => p.startsWith('/notas-credito'),
  },
];

/**
 * Pestañas de navegación del módulo Caja.
 * Inspirado en las tabs del módulo de Caja del DIH ERP.
 * Cada tab navega a su ruta dedicada — mantenemos la modularidad de las páginas existentes.
 */
export function CajaTabs() {
  const path = usePathname();

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="inline-flex min-w-full sm:min-w-0 gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 p-1">
        {TABS.map(tab => {
          const activo = tab.matchPath(path);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                'inline-flex items-center gap-2 px-3 sm:px-4 h-9 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap',
                activo
                  ? 'bg-[hsl(var(--brand-accent))]/15 text-[hsl(var(--brand-accent))] shadow-sm'
                  : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))] hover:bg-[hsl(var(--surface-2))]/60',
              )}
            >
              {tab.icono}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
