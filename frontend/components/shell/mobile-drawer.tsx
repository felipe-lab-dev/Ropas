'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Wallet,
  Users, BarChart3, Settings, Building2, Home, History,
  Truck, PackageCheck, BookOpen, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfigSaas } from '@/lib/store/config-saas';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const SECCIONES = [
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
      { label: 'Historial', href: '/caja/historial', icon: History, modulo: 'caja' },
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
      { label: 'Configuración', href: '/configuracion', icon: Settings },
    ],
  },
] as const;

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const moduloHabilitado = useConfigSaas(s => s.moduloHabilitado);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  React.useEffect(() => { onClose(); /* cierra al navegar */ }, [pathname]); // eslint-disable-line

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-[82vw] max-w-sm gradient-sidebar border-r border-[hsl(var(--border))] flex flex-col overflow-hidden"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-[hsl(var(--border))]">
              <span className="font-bold text-base">Ropas</span>
              <button
                onClick={onClose}
                className="size-9 rounded-lg grid place-items-center hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-muted))]"
                aria-label="Cerrar menú"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 flex flex-col gap-4">
              {SECCIONES.map(seccion => {
                const items = seccion.items.filter(
                  i => !('modulo' in i) || !i.modulo || moduloHabilitado(i.modulo as string),
                );
                if (items.length === 0) return null;
                return (
                  <div key={seccion.titulo} className="flex flex-col gap-0.5">
                    <div className="px-3 mb-1 text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--text-muted))]">
                      {seccion.titulo}
                    </div>
                    {items.map(item => {
                      const Icon = item.icon;
                      const activo = pathname === item.href || pathname.startsWith(item.href + '/');
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 h-11 text-sm font-medium transition-colors',
                            activo
                              ? 'text-white bg-gradient-to-r from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))]'
                              : 'text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))]/60 hover:text-[hsl(var(--text))]',
                          )}
                        >
                          <Icon className="size-[18px] shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
