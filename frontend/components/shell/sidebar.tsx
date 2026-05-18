'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Wallet,
  Users, BarChart3, Settings, Building2, ChevronLeft, Sparkles,
  Receipt, Home, History, Truck, PackageCheck, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigSaas } from '@/lib/store/config-saas';
import { useSesion } from '@/lib/store/sesion';
import { iniciales } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  modulo?: string;
}

interface NavSection {
  titulo: string;
  items: NavItem[];
}

const SECCIONES: NavSection[] = [
  {
    titulo: 'Resumen',
    items: [
      { label: 'Inicio', href: '/bienvenida', icon: Home },
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Reportes', href: '/reportes', icon: BarChart3, modulo: 'reportes' },
    ],
  },
  {
    titulo: 'Operación',
    items: [
      { label: 'Punto de Venta', href: '/pos', icon: ShoppingCart, modulo: 'ventas' },
      { label: 'Ventas', href: '/ventas', icon: Receipt, modulo: 'ventas' },
      { label: 'Caja', href: '/caja', icon: Wallet, modulo: 'caja' },
      { label: 'Historial de caja', href: '/caja/historial', icon: History, modulo: 'caja' },
    ],
  },
  {
    titulo: 'Catálogo',
    items: [
      { label: 'Productos', href: '/productos', icon: Package, modulo: 'productos' },
      { label: 'Inventario', href: '/inventario', icon: Boxes, modulo: 'inventario' },
    ],
  },
  {
    titulo: 'Abastecimiento',
    items: [
      { label: 'Proveedores', href: '/proveedores', icon: Truck, modulo: 'proveedores' },
      { label: 'Compras', href: '/compras', icon: PackageCheck, modulo: 'compras' },
    ],
  },
  {
    titulo: 'Finanzas',
    items: [
      { label: 'Contabilidad', href: '/contabilidad', icon: BookOpen, modulo: 'contabilidad' },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { label: 'Clientes', href: '/clientes', icon: Users, modulo: 'clientes' },
      { label: 'Sucursales', href: '/sucursales', icon: Building2 },
    ],
  },
];

export function Sidebar() {
  const [colapsado, setColapsado] = React.useState(false);
  const [colapsadoManual, setColapsadoManual] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const aplicar = () => {
      if (mq.matches) setColapsado(true);
      else if (!colapsadoManual) setColapsado(false);
    };
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [colapsadoManual]);
  const moduloHabilitado = useConfigSaas(s => s.moduloHabilitado);
  const usuario = useSesion(s => s.usuario);

  return (
    <motion.aside
      animate={{ width: colapsado ? 76 : 256 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="relative flex flex-col border-r border-[hsl(var(--border))] gradient-sidebar py-5 px-3"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 h-10 mb-6">
        <div className="size-9 rounded-xl gradient-brand-accent grid place-items-center shadow-[0_4px_16px_hsl(var(--brand-primary)/0.35)] shrink-0">
          <Sparkles className="size-4.5 text-white" />
        </div>
        <AnimatePresence mode="wait">
          {!colapsado && (
            <motion.div
              key="brand-text"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col min-w-0"
            >
              <span className="font-bold text-base tracking-tight leading-none">Ropas</span>
              <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] mt-0.5">
                ERP
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 flex flex-col gap-5 overflow-y-auto scrollbar-thin -mx-1 px-1">
        {SECCIONES.map((seccion, seccionIdx) => {
          const items = seccion.items.filter(i => !i.modulo || moduloHabilitado(i.modulo));
          if (items.length === 0) return null;
          return (
            <div key={seccion.titulo} className="flex flex-col gap-0.5">
              <AnimatePresence>
                {!colapsado && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="px-3 mb-1 text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--text-muted))]"
                  >
                    {seccion.titulo}
                  </motion.div>
                )}
              </AnimatePresence>
              {items.map((item, i) => {
                const coincide = (h: string) => pathname === h || pathname.startsWith(h + '/');
                const activo =
                  coincide(item.href) &&
                  !items.some(o => o !== item && o.href.length > item.href.length && coincide(o.href));
                const Icon = item.icon;
                const idx = seccionIdx * 3 + i + 1;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 h-10 text-sm font-medium transition-all animate-slide-right',
                      `stagger-${Math.min(idx, 9)}`,
                      activo
                        ? 'text-white bg-gradient-to-r from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))] shadow-[0_4px_14px_hsl(var(--brand-primary)/0.35)]'
                        : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))]/60 hover:text-[hsl(var(--text))]',
                    )}
                  >
                    {activo && <span className="sidebar-active-bar" />}
                    <Icon className={cn('size-[18px] shrink-0', activo && 'drop-shadow')} />
                    <AnimatePresence>
                      {!colapsado && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {colapsado && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-[hsl(265_30%_12%)] text-[hsl(0_0%_98%)] text-xs font-medium opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-50 border border-white/5">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer: config + avatar */}
      <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex flex-col gap-2">
        <Link
          href="/configuracion"
          className={cn(
            'group relative flex items-center gap-3 rounded-lg px-3 h-10 text-sm font-medium transition-all',
            pathname.startsWith('/configuracion')
              ? 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text))]'
              : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))]/60 hover:text-[hsl(var(--text))]',
          )}
        >
          <Settings className="size-[18px] shrink-0" />
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
          {colapsado && (
            <span className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-[hsl(265_30%_12%)] text-[hsl(0_0%_98%)] text-xs font-medium opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-50 border border-white/5">
              Configuración
            </span>
          )}
        </Link>

        {usuario && !colapsado && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-[hsl(var(--surface-2))]/40"
          >
            <div className="size-8 rounded-full gradient-brand-accent grid place-items-center text-white text-[11px] font-bold shrink-0">
              {iniciales(usuario.nombre)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{usuario.nombre}</div>
              <div className="text-[10px] text-[hsl(var(--text-muted))] truncate">{usuario.rol}</div>
            </div>
          </motion.div>
        )}
      </div>

      <button
        onClick={() => {
          setColapsado(c => !c);
          setColapsadoManual(m => !m);
        }}
        className="absolute -right-3 top-8 size-7 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))] grid place-items-center hover:bg-[hsl(var(--brand-primary))] hover:text-white hover:border-[hsl(var(--brand-primary))] transition-all shadow-md z-10"
        aria-label={colapsado ? 'Expandir' : 'Colapsar'}
      >
        <ChevronLeft
          className={cn('size-3.5 transition-transform duration-300', colapsado && 'rotate-180')}
        />
      </button>
    </motion.aside>
  );
}
