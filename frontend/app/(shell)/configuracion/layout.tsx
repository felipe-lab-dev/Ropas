'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Hash, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/configuracion', label: 'General', icon: Settings },
  { href: '/configuracion/facturacion-electronica', label: 'Facturación Electrónica', icon: FileText },
  { href: '/configuracion/series-cpe', label: 'Series de comprobantes', icon: Hash },
] as const;

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // next.config tiene trailingSlash: true → usePathname devuelve '/configuracion/'.
  // Normalizamos sacando la barra final antes de comparar contra los href de TABS.
  const pathActual = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return (
    <div className="flex flex-col">
      <nav
        className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]/85 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--bg))]/60"
        aria-label="Sub-navegación de configuración"
      >
        <div className="flex gap-1.5 overflow-x-auto px-4 sm:px-6 lg:px-8 py-2.5 scrollbar-thin">
          {TABS.map((tab) => {
            const activa = pathActual === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={activa ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-all',
                  activa
                    ? 'bg-[hsl(var(--brand-primary))] font-semibold text-white shadow-[0_4px_14px_-2px_hsl(var(--brand-primary)/0.45)]'
                    : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))]/60 hover:text-[hsl(var(--text))]',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
