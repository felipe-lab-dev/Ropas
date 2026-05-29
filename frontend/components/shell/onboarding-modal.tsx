'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Package, ShoppingCart, BarChart3, Settings,
  ChevronRight, ChevronLeft, Check, Palette,
} from 'lucide-react';
import { DialogShell } from '@/components/ui/dialog-shell';
import { Button } from '@/components/ui/button';
import { useSesion } from '@/lib/store/sesion';

const STORAGE_KEY = 'ropas.onboarding.completado';

interface Paso {
  id: string;
  icono: React.ElementType;
  titulo: string;
  descripcion: string;
  highlight: string[];
}

const PASOS: Paso[] = [
  {
    id: 'bienvenida',
    icono: Sparkles,
    titulo: '¡Bienvenido a Ropas!',
    descripcion: 'Tu ERP para tienda de ropa. Vende más rápido, controla tu tienda. Te mostramos lo esencial en 4 pasos.',
    highlight: ['Catálogo con variantes', 'POS rápido', 'Inventario multi-sucursal', 'Reportes en tiempo real'],
  },
  {
    id: 'productos',
    icono: Package,
    titulo: 'Carga tu catálogo',
    descripcion: 'Crea productos con variantes (talla, color, material). Cada variante tiene su propio SKU, código de barras y stock por sucursal.',
    highlight: ['Imágenes múltiples', 'Categorías y marcas', 'Precio base + override por variante'],
  },
  {
    id: 'pos',
    icono: ShoppingCart,
    titulo: 'Vende desde el POS',
    descripcion: 'Busca por nombre, SKU o escanea el código de barras. Acepta efectivo, tarjeta o Yape/Plin. El stock se descuenta automáticamente.',
    highlight: ['Búsqueda al instante', 'Cobro multi-medio', 'Stock real-time'],
  },
  {
    id: 'reportes',
    icono: BarChart3,
    titulo: 'Reportes y analítica',
    descripcion: 'Mira tus ventas por categoría, tendencia semanal, top vendidos y stock crítico. Todo en gráficos animados.',
    highlight: ['Ventas por categoría', 'Stock bajo automático', 'Top vendidos mensual'],
  },
];

export function OnboardingModal() {
  const usuario = useSesion(s => s.usuario);
  const [abierto, setAbierto] = React.useState(false);
  const [paso, setPaso] = React.useState(0);

  React.useEffect(() => {
    if (!usuario) return;
    if (typeof window === 'undefined') return;
    const visto = window.localStorage.getItem(STORAGE_KEY);
    if (!visto) {
      // pequeña espera para que se vea el dashboard primero
      const t = setTimeout(() => setAbierto(true), 800);
      return () => clearTimeout(t);
    }
  }, [usuario]);

  const completar = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setAbierto(false);
  };

  if (!usuario) return null;

  const p = PASOS[paso]!;
  const ultimo = paso === PASOS.length - 1;
  const Icono = p.icono;

  return (
    <DialogShell
      open={abierto}
      onOpenChange={setAbierto}
      titulo={p.titulo}
      subtitulo={`Paso ${paso + 1} de ${PASOS.length}`}
      icono={<Icono className="size-5" />}
      variante="brand"
      tamano="md"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <button
            onClick={completar}
            className="text-xs text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))] transition-colors"
          >
            Saltar tour
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPaso(p => Math.max(0, p - 1))}
              disabled={paso === 0}
            >
              <ChevronLeft className="size-4" /> Atrás
            </Button>
            {ultimo ? (
              <Button size="sm" onClick={completar}>
                <Check className="size-4" /> Empezar
              </Button>
            ) : (
              <Button size="sm" onClick={() => setPaso(p => p + 1)}>
                Siguiente <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={p.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          <p className="text-sm text-[hsl(var(--text))] leading-relaxed">
            {p.descripcion}
          </p>

          <div className="grid sm:grid-cols-2 gap-2">
            {p.highlight.map((h, i) => (
              <motion.div
                key={h}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-2 p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 text-xs"
              >
                <span className="size-5 rounded-full gradient-brand-accent grid place-items-center shrink-0">
                  <Check className="size-3 text-white" />
                </span>
                <span className="font-medium">{h}</span>
              </motion.div>
            ))}
          </div>

          {paso === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--brand-primary))]/8 border border-[hsl(var(--brand-primary))]/20 text-xs"
            >
              <Palette className="size-4 text-[hsl(var(--brand-primary))] shrink-0" />
              <span>
                Tip: en{' '}
                <a href="/configuracion" className="font-semibold underline">
                  Configuración
                </a>{' '}
                puedes elegir entre 7 paletas y modo claro/oscuro.
              </span>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Indicador de pasos */}
      <div className="flex items-center justify-center gap-1.5 mt-6">
        {PASOS.map((_, i) => (
          <button
            key={i}
            onClick={() => setPaso(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === paso
                ? 'w-8 bg-[hsl(var(--brand-primary))]'
                : 'w-1.5 bg-[hsl(var(--border))] hover:bg-[hsl(var(--brand-primary))]/40'
            }`}
            aria-label={`Ir al paso ${i + 1}`}
          />
        ))}
      </div>
    </DialogShell>
  );
}
