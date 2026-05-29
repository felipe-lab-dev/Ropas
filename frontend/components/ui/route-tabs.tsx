'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface RouteTab {
  /** Clave única para React. */
  key: string;
  /** Texto visible de la pestaña. */
  label: string;
  /** Ruta destino (puede incluir query string, ej. `/ventas?desde=hoy`). */
  href: string;
  /** Icono opcional (componente Lucide ya instanciado, ej. `<Wallet className="size-3.5" />`). */
  icono?: React.ReactNode;
  /**
   * Override del match de ruta activa. Por default compara igualdad exacta
   * contra el `href` (sin query string), normalizando el trailing slash.
   * Útil para tabs que deben quedar activas en sub-rutas (`p.startsWith('/caja/historial')`).
   */
  matchPath?: (path: string) => boolean;
}

interface RouteTabsProps {
  tabs: RouteTab[];
  /** Etiqueta accesible de la barra de navegación. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Tabs canónicas de navegación entre rutas (sub-navegación de módulo).
 *
 * Estilo único para toda la app: control segmentado tipo "pill" con texto en
 * MAYÚSCULAS, coherente con el componente base shadcn `Tabs` (`components/ui/tabs.tsx`).
 *
 * NO usar para togglear estado/filtros (eso es un segmented control distinto)
 * ni para cambiar paneles dentro de una misma vista (usar `Tabs` de shadcn).
 *
 * Lo usan: módulo Caja y Configuración. Para agregar una nueva sub-navegación,
 * definí el array de `RouteTab` y renderizá `<RouteTabs tabs={...} />`.
 */
export function RouteTabs({ tabs, ariaLabel, className }: RouteTabsProps) {
  const pathname = usePathname();
  // next.config tiene trailingSlash: true → usePathname puede devolver '/caja/'.
  // Normalizamos sacando la barra final antes de comparar contra los href.
  const path =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  return (
    <div className={cn('overflow-x-auto -mx-1 px-1', className)}>
      <nav
        aria-label={ariaLabel}
        className="inline-flex min-w-full gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 p-1 sm:min-w-0"
      >
        {tabs.map((tab) => {
          const hrefBase = tab.href.split('?')[0];
          const activo = tab.matchPath ? tab.matchPath(path) : path === hrefBase;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={activo ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-all sm:px-4',
                activo
                  ? 'bg-[hsl(var(--brand-accent))]/15 text-[hsl(var(--brand-accent))] shadow-sm'
                  : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))]/60 hover:text-[hsl(var(--text))]',
              )}
            >
              {tab.icono}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
