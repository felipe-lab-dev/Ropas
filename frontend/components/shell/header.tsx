'use client';

import * as React from 'react';
import { Search, Sun, Moon, LogOut, ChevronRight, Menu, Clock3 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useApariencia } from '@/lib/store/apariencia';
import { useSesion } from '@/lib/store/sesion';
import { useConfigSaas } from '@/lib/store/config-saas';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { CommandPalette } from './command-palette';
import { cn } from '@/lib/utils';
import {
  useInactividad,
  formatearRestante,
  MOSTRAR_DESDE_MS,
} from '@/lib/use-inactividad';

const TITULOS: Record<string, string> = {
  '/bienvenida': 'Inicio',
  '/dashboard': 'Dashboard',
  '/productos': 'Productos',
  '/pos': 'Punto de Venta',
  '/ventas': 'Ventas',
  '/inventario': 'Inventario',
  '/caja': 'Caja',
  '/clientes': 'Clientes',
  '/sucursales': 'Sucursales',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
};

interface HeaderProps {
  onOpenMenu?: () => void;
}

export function Header({ onOpenMenu }: HeaderProps = {}) {
  const tema = useApariencia(s => s.tema);
  const setTema = useApariencia(s => s.setTema);
  const usuario = useSesion(s => s.usuario);
  const limpiar = useSesion(s => s.limpiar);
  const config = useConfigSaas(s => s.config);
  const router = useRouter();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const { restanteMs } = useInactividad();
  const mostrarCountdown = !!usuario && restanteMs > 0 && restanteMs <= MOSTRAR_DESDE_MS;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cerrar = () => {
    limpiar();
    router.push('/login');
  };

  const tituloActual = React.useMemo(() => {
    const key = Object.keys(TITULOS).find(k => pathname.startsWith(k));
    return key ? TITULOS[key] : '';
  }, [pathname]);

  return (
    <>
      <header
        className="h-14 border-b border-[hsl(var(--border))] surface-glass sticky top-0 z-30 flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          height: 'calc(3.5rem + env(safe-area-inset-top))',
        }}
      >
        {/* Botón menú móvil */}
        {onOpenMenu && (
          <button
            onClick={onOpenMenu}
            className="lg:hidden size-9 rounded-lg grid place-items-center hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))] -ml-1"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
        )}

        {/* Breadcrumb / título */}
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-[hsl(var(--text-muted))] font-medium">Ropas</span>
          {tituloActual && (
            <>
              <ChevronRight className="hidden sm:inline size-3.5 text-[hsl(var(--text-muted))]" />
              <motion.span
                key={tituloActual}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="font-semibold truncate"
              >
                {tituloActual}
              </motion.span>
            </>
          )}
        </div>

        {/* Búsqueda Ctrl+K — desktop: input ancho; móvil: solo ícono */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden md:flex items-center gap-3 px-3.5 h-9 rounded-lg bg-[hsl(var(--surface-2))]/70 hover:bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] transition-all min-w-[240px] max-w-[420px] text-sm text-[hsl(var(--text-muted))] hover:border-[hsl(var(--brand-primary))]/40 ml-4"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar módulos, productos, ventas…</span>
          <kbd className="ml-auto rounded border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-1.5 py-0.5 text-[10px] font-mono">
            Ctrl K
          </kbd>
        </button>
        <button
          onClick={() => setPaletteOpen(true)}
          className="md:hidden ml-auto size-9 rounded-lg grid place-items-center hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))]"
          aria-label="Buscar"
        >
          <Search className="size-4" />
        </button>

        <div className="md:ml-auto flex items-center gap-1.5 sm:gap-3">
          <AnimatePresence>
            {mostrarCountdown && (
              <motion.div
                key="countdown-inactividad"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                title="Tu sesion se cerrara por inactividad"
                className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--brand-danger))]/15 text-[hsl(var(--brand-danger))] border border-[hsl(var(--brand-danger))]/30 px-2.5 py-1 text-xs font-semibold tabular-nums"
              >
                <Clock3 className="size-3.5" />
                <span className="font-mono">{formatearRestante(restanteMs)}</span>
              </motion.div>
            )}
          </AnimatePresence>
          {config && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden md:flex items-center gap-2 text-xs"
            >
              <span className="text-[hsl(var(--text-muted))]">{config.branding?.nombre ?? config.tenant.nombre}</span>
              <span className="rounded-full bg-gradient-to-r from-[hsl(var(--brand-primary))]/15 to-[hsl(var(--brand-accent))]/15 text-[hsl(var(--brand-primary))] px-2.5 py-0.5 font-semibold border border-[hsl(var(--brand-primary))]/20">
                {config.plan.nombre}
              </span>
            </motion.div>
          )}

          <button
            onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
            className="size-9 rounded-lg grid place-items-center hover:bg-[hsl(var(--surface-2))] transition-colors text-[hsl(var(--text-muted))] hover:text-[hsl(var(--brand-primary))]"
            aria-label="Cambiar tema"
          >
            <AnimatePresence mode="wait">
              {tema === 'dark' ? (
                <motion.span
                  key="sun"
                  initial={{ rotate: -45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 45, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="inline-flex"
                >
                  <Sun className="size-4 text-[hsl(var(--brand-accent))]" />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ rotate: 45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -45, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="inline-flex"
                >
                  <Moon className="size-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {usuario && (
            <Button variant="ghost" size="icon-sm" onClick={cerrar} aria-label="Cerrar sesión" className="hover:text-[hsl(var(--brand-danger))]">
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
