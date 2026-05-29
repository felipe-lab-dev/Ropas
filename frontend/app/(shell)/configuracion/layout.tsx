'use client';

import * as React from 'react';
import { FileText, Hash, Settings } from 'lucide-react';
import { RouteTabs, type RouteTab } from '@/components/ui/route-tabs';

const TABS: RouteTab[] = [
  {
    key: 'general',
    label: 'General',
    href: '/configuracion',
    icono: <Settings className="size-3.5" />,
    matchPath: (p) => p === '/configuracion',
  },
  {
    key: 'facturacion',
    label: 'Facturación Electrónica',
    href: '/configuracion/facturacion-electronica',
    icono: <FileText className="size-3.5" />,
    matchPath: (p) => p.startsWith('/configuracion/facturacion-electronica'),
  },
  {
    key: 'series',
    label: 'Series de comprobantes',
    href: '/configuracion/series-cpe',
    icono: <Hash className="size-3.5" />,
    matchPath: (p) => p.startsWith('/configuracion/series-cpe'),
  },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <RouteTabs tabs={TABS} ariaLabel="Sub-navegación de configuración" />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
