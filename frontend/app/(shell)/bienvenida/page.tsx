'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Wallet,
  Users, BarChart3, Building2, Receipt, RefreshCw, ChevronLeft, ChevronRight,
  Star, Sparkles,
} from 'lucide-react';
import { Logo3D } from '@/components/bienvenida/logo-3d';
import { useSesion } from '@/lib/store/sesion';
import { useConfigSaas } from '@/lib/store/config-saas';
import { FRASES_ROPA, type FraseRopa } from '@/lib/frases-ropa';

interface Modulo {
  label: string;
  icono: React.ElementType;
  ruta: string;
  modulo?: string;
}

const MODULOS: Modulo[] = [
  { label: 'Dashboard', icono: LayoutDashboard, ruta: '/dashboard' },
  { label: 'POS', icono: ShoppingCart, ruta: '/pos', modulo: 'ventas' },
  { label: 'Ventas', icono: Receipt, ruta: '/ventas', modulo: 'ventas' },
  { label: 'Productos', icono: Package, ruta: '/productos', modulo: 'productos' },
  { label: 'Inventario', icono: Boxes, ruta: '/inventario', modulo: 'inventario' },
  { label: 'Caja', icono: Wallet, ruta: '/caja', modulo: 'caja' },
  { label: 'Clientes', icono: Users, ruta: '/clientes', modulo: 'clientes' },
  { label: 'Sucursales', icono: Building2, ruta: '/sucursales' },
  { label: 'Reportes', icono: BarChart3, ruta: '/reportes', modulo: 'reportes' },
];

const POR_PAGINA = 8;

const ETIQUETA: Record<FraseRopa['categoria'], string> = {
  dato: 'Dato',
  tip: 'Tip',
  curiosidad: 'Curiosidad',
};

function fraseAleatoria(exclude?: FraseRopa): FraseRopa {
  if (FRASES_ROPA.length <= 1) return FRASES_ROPA[0]!;
  let elegida: FraseRopa;
  do {
    elegida = FRASES_ROPA[Math.floor(Math.random() * FRASES_ROPA.length)]!;
  } while (exclude && elegida.texto === exclude.texto);
  return elegida;
}

export default function BienvenidaPage() {
  const usuario = useSesion(s => s.usuario);
  const moduloHabilitado = useConfigSaas(s => s.moduloHabilitado);
  const [pagina, setPagina] = React.useState(0);
  const [frase, setFrase] = React.useState<FraseRopa>(() => fraseAleatoria());

  const modulosVisibles = React.useMemo(
    () => MODULOS.filter(m => !m.modulo || moduloHabilitado(m.modulo)),
    [moduloHabilitado],
  );
  const totalPaginas = Math.max(1, Math.ceil(modulosVisibles.length / POR_PAGINA));
  const inicio = pagina * POR_PAGINA;
  const modulosPagina = modulosVisibles.slice(inicio, inicio + POR_PAGINA);

  React.useEffect(() => {
    const t = setInterval(() => setFrase(f => fraseAleatoria(f)), 9000);
    return () => clearInterval(t);
  }, []);

  const filasGrid = modulosPagina.length <= 4 ? 1 : 2;

  return (
    <div className="relative -m-8 h-[calc(100vh-3.5rem)] w-[calc(100%+4rem)] overflow-hidden flex flex-col py-4 px-6
                    bg-gradient-to-br from-[hsl(var(--bg))] via-[hsl(var(--surface))] to-[hsl(var(--surface-2))]">
      {/* Mesh grid de fondo */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="bv-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="hsl(var(--text))" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bv-grid)" />
      </svg>

      {/* Orbes decorativos */}
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none login-float-1"
        style={{ background: 'hsl(var(--brand-primary) / 0.18)' }}
      />
      <div
        className="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] rounded-full blur-3xl pointer-events-none login-float-2"
        style={{ background: 'hsl(var(--brand-accent) / 0.14)' }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl pointer-events-none login-float-3"
        style={{ background: 'hsl(var(--brand-primary-hover) / 0.10)' }}
      />

      {/* Columna principal */}
      <div className="relative z-10 flex flex-col flex-1 min-h-0 gap-3 md:gap-4 w-full max-w-5xl mx-auto">
        {/* Saludo arriba */}
        {usuario && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center shrink-0"
          >
            <p className="text-sm text-[hsl(var(--text-muted))]">
              {saludoHora()}, <span className="font-semibold text-[hsl(var(--text))]">{usuario.nombre}</span>
            </p>
          </motion.div>
        )}

        {/* Canvas 3D del logo */}
        <Logo3D className="flex-1 min-h-[180px]" />

        {/* Grid de módulos paginado */}
        {modulosVisibles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="shrink-0"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-muted))]">
                Tus módulos
              </span>
              {totalPaginas > 1 && (
                <span className="text-[10px] text-[hsl(var(--text-muted))]/70 tabular-nums">
                  {pagina + 1} / {totalPaginas}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {totalPaginas > 1 && (
                <button
                  onClick={() => setPagina(p => (p - 1 + totalPaginas) % totalPaginas)}
                  className="shrink-0 size-9 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))]/70 backdrop-blur-sm grid place-items-center text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface))] hover:border-[hsl(var(--brand-primary))]/40 hover:text-[hsl(var(--brand-primary))] transition-all"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </button>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={pagina}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-4 gap-2 flex-1"
                  style={{
                    gridTemplateRows: `repeat(${filasGrid}, minmax(60px, 1fr))`,
                    minHeight: filasGrid === 2 ? 132 : 64,
                  }}
                >
                  {modulosPagina.map((m, i) => {
                    const Icon = m.icono;
                    return (
                      <motion.div
                        key={m.ruta}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <Link
                          href={m.ruta}
                          className="group flex flex-col items-center justify-center gap-1.5 px-2 py-2 h-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]/70 backdrop-blur-sm hover:border-[hsl(var(--brand-primary))]/50 hover:shadow-[var(--shadow-md)] hover:bg-[hsl(var(--surface))] transition-all"
                        >
                          <div className="size-9 rounded-lg bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--brand-primary))] grid place-items-center group-hover:scale-110 group-hover:bg-[hsl(var(--brand-primary))]/20 transition-all">
                            <Icon className="size-[18px]" />
                          </div>
                          <span className="text-[11px] font-semibold text-center truncate max-w-full">
                            {m.label}
                          </span>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
              {totalPaginas > 1 && (
                <button
                  onClick={() => setPagina(p => (p + 1) % totalPaginas)}
                  className="shrink-0 size-9 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))]/70 backdrop-blur-sm grid place-items-center text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface))] hover:border-[hsl(var(--brand-primary))]/40 hover:text-[hsl(var(--brand-primary))] transition-all"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Frase rotativa */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="shrink-0 w-full max-w-3xl mx-auto"
        >
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))]/60 backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 shadow-sm">
            <Sparkles className="size-4 text-[hsl(var(--brand-accent))] shrink-0" />
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-[hsl(var(--brand-primary))]/15 text-[hsl(var(--brand-primary))]">
                {ETIQUETA[frase.categoria]}
              </span>
              <AnimatePresence mode="wait">
                <motion.p
                  key={frase.texto}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs md:text-sm text-[hsl(var(--text))] leading-snug"
                >
                  {frase.texto}
                </motion.p>
              </AnimatePresence>
            </div>
            <button
              onClick={() => setFrase(f => fraseAleatoria(f))}
              title="Siguiente"
              className="shrink-0 size-7 rounded-md grid place-items-center text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))] hover:bg-[hsl(var(--surface-2))] transition-colors"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function saludoHora(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
