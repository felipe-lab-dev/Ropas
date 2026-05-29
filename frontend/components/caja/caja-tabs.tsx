'use client';

import * as React from 'react';
import { Wallet, Lock, ShoppingBag, Undo2 } from 'lucide-react';
import { RouteTabs, type RouteTab } from '@/components/ui/route-tabs';

const TABS: RouteTab[] = [
  {
    key: 'hoy',
    label: 'Caja de hoy',
    href: '/caja',
    icono: <Wallet className="size-3.5" />,
    matchPath: (p) => p === '/caja',
  },
  {
    key: 'cierres',
    label: 'Cierres de Caja',
    href: '/caja/historial',
    icono: <Lock className="size-3.5" />,
    matchPath: (p) => p.startsWith('/caja/historial'),
  },
  {
    key: 'ventas-dia',
    label: 'Ventas del día',
    href: '/caja/ventas-dia',
    icono: <ShoppingBag className="size-3.5" />,
    matchPath: (p) => p.startsWith('/caja/ventas-dia'),
  },
  {
    key: 'notas-credito',
    label: 'Notas de crédito',
    href: '/caja/notas-credito',
    icono: <Undo2 className="size-3.5" />,
    matchPath: (p) => p.startsWith('/caja/notas-credito'),
  },
];

/**
 * Pestañas de navegación del módulo Caja.
 * Usa el componente canónico `RouteTabs` para mantener el estilo unificado
 * con el resto de las sub-navegaciones de la app (ej. Configuración).
 */
export function CajaTabs() {
  return <RouteTabs tabs={TABS} ariaLabel="Sub-navegación de caja" />;
}
