'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Wallet,
  Users, BarChart3, Settings, Building2, ChevronLeft, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigSaas } from '@/lib/store/config-saas';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  modulo?: string;
}

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Productos', href: '/productos', icon: Package, modulo: 'productos' },
  { label: 'Punto de Venta', href: '/pos', icon: ShoppingCart, modulo: 'ventas' },
  { label: 'Ventas', href: '/ventas', icon: ShoppingCart, modulo: 'ventas' },
  { label: 'Inventario', href: '/inventario', icon: Boxes, modulo: 'inventario' },
  { label: 'Caja', href: '/caja', icon: Wallet, modulo: 'caja' },
  { label: 'Clientes', href: '/clientes', icon: Users, modulo: 'clientes' },
  { label: 'Sucursales', href: '/sucursales', icon: Building2 },
  { label: 'Reportes', href: '/reportes', icon: BarChart3, modulo: 'reportes' },
];

export function Sidebar() {
  const [colapsado, setColapsado] = React.useState(false);
  const pathname = usePathname();
  const moduloHabilitado = useConfigSaas(s => s.moduloHabilitado);

  const items = NAV.filter(i => !i.modulo || moduloHabilitado(i.modulo));

  return (
    <motion.aside
      animate={{ width: colapsado ? 72 : 240 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="relative flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] py-4 px-3"
    >
      <div className="flex items-center justify-between mb-8 px-2 h-9">
        <AnimatePresence mode="wait">
          {!colapsado ? (
            <motion.div
              key="logo-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="size-8 rounded-md bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] grid place-items-center">
                <Sparkles className="size-4 text-white" />
              </div>
              <span className="font-bold text-base tracking-tight">Ropas</span>
            </motion.div>
          ) : (
            <motion.div
              key="logo-compact"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="size-8 rounded-md bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] grid place-items-center mx-auto"
            >
              <Sparkles className="size-4 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5">
        {items.map(item => {
          const activo = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-md px-2.5 h-9 text-sm transition-all relative',
                activo
                  ? 'bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--brand-primary))] font-medium'
                  : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text))]',
              )}
            >
              {activo && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[hsl(var(--brand-primary))]"
                />
              )}
              <Icon className="size-4 shrink-0" />
              <AnimatePresence>
                {!colapsado && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-[hsl(var(--border))]">
        <Link
          href="/configuracion"
          className={cn(
            'flex items-center gap-3 rounded-md px-2.5 h-9 text-sm transition-colors',
            pathname.startsWith('/configuracion')
              ? 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text))]'
              : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text))]',
          )}
        >
          <Settings className="size-4 shrink-0" />
          <AnimatePresence>
            {!colapsado && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="whitespace-nowrap"
              >
                Configuración
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      <button
        onClick={() => setColapsado(c => !c)}
        className="absolute -right-3 top-7 size-6 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] grid place-items-center hover:bg-[hsl(var(--brand-primary))] hover:text-white transition-colors"
      >
        <ChevronLeft
          className={cn('size-3 transition-transform', colapsado && 'rotate-180')}
        />
      </button>
    </motion.aside>
  );
}
