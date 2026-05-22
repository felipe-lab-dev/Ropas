'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, Package, Wallet, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigSaas } from '@/lib/store/config-saas';

interface MobileNavProps {
  onOpenMenu: () => void;
}

const ITEMS = [
  { label: 'Inicio', href: '/bienvenida', icon: Home },
  { label: 'POS', href: '/pos', icon: ShoppingCart, modulo: 'ventas' },
  { label: 'Productos', href: '/productos', icon: Package, modulo: 'productos' },
  { label: 'Caja', href: '/caja', icon: Wallet, modulo: 'caja' },
] as const;

export function MobileNav({ onOpenMenu }: MobileNavProps) {
  const pathname = usePathname();
  const moduloHabilitado = useConfigSaas(s => s.moduloHabilitado);
  const items = ITEMS.filter(i => !('modulo' in i) || !i.modulo || moduloHabilitado(i.modulo));

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 surface-glass border-t border-[hsl(var(--border))]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación inferior"
    >
      <ul className="grid grid-cols-5 h-14">
        {items.map(item => {
          const Icon = item.icon;
          const activo = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  activo
                    ? 'text-[hsl(var(--brand-primary))]'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]',
                )}
              >
                <Icon className={cn('size-5', activo && 'drop-shadow-[0_0_8px_hsl(var(--brand-primary)/0.6)]')} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <button
            onClick={onOpenMenu}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]"
            aria-label="Abrir menú completo"
          >
            <Menu className="size-5" />
            <span>Más</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
