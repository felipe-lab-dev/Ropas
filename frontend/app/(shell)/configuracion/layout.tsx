'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Hash, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/configuracion', label: 'General', icon: Settings },
  { href: '/configuracion/facturacion-electronica', label: 'Facturación Electrónica', icon: FileText },
  { href: '/configuracion/series-cpe', label: 'Series CPE', icon: Hash },
] as const;

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col">
      <nav
        className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]/85 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--bg))]/60"
        aria-label="Sub-navegación de configuración"
      >
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8 scrollbar-thin">
          {TABS.map((tab) => {
            const activa = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={activa ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3.5 text-sm transition-colors',
                  activa
                    ? 'border-[hsl(var(--brand-primary))] font-semibold text-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/8'
                    : 'border-transparent text-[hsl(var(--text-muted))] hover:border-[hsl(var(--brand-primary))]/40 hover:text-[hsl(var(--text))]',
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
