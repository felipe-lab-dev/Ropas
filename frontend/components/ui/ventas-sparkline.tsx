'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';

interface VentaMes {
  mes: string; // 'YYYY-MM'
  cantidad: number;
}

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function etiquetaMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES_ES[(m ?? 1) - 1]} '${String(y ?? 0).slice(2)}`;
}

interface Props {
  serie: VentaMes[];
  total: number;
  color?: string;
}

/**
 * Botón "?" con popover que muestra un sparkline (bar chart simple en SVG)
 * de las ventas mensuales del producto en los últimos 12 meses.
 */
export function VentasSparkline({ serie, total, color = '#8b5cf6' }: Props) {
  const [abierto, setAbierto] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  const max = Math.max(1, ...serie.map(s => s.cantidad));
  const ultimoMes = serie[serie.length - 1]?.cantidad ?? 0;
  const penultimo = serie[serie.length - 2]?.cantidad ?? 0;
  const tendencia = ultimoMes - penultimo;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setAbierto(true)}
        onFocus={() => setAbierto(true)}
        onClick={() => setAbierto(o => !o)}
        className="size-4 grid place-items-center rounded-full text-[hsl(var(--text-muted))] hover:text-[hsl(var(--brand-primary))] hover:bg-[hsl(var(--brand-primary))]/10 transition-all"
        aria-label="Ver movimiento de ventas"
      >
        <Info className="size-3" />
      </button>
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            onMouseLeave={() => setAbierto(false)}
            className="absolute right-0 top-full mt-2 z-50 w-72 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-[hsl(var(--text-muted))]">
                  Ventas últimos 12 meses
                </div>
                <div className="text-xl font-bold tabular-nums" style={{ color }}>
                  {total} <span className="text-[10px] font-normal text-[hsl(var(--text-muted))]">unidades</span>
                </div>
              </div>
              {tendencia !== 0 && (
                <div
                  className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
                    tendencia > 0 ? 'text-[hsl(var(--brand-success))]' : 'text-[hsl(var(--brand-danger))]'
                  }`}
                >
                  {tendencia > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {tendencia > 0 ? '+' : ''}{tendencia}
                </div>
              )}
            </div>
            <svg viewBox="0 0 240 70" className="w-full h-16">
              {serie.map((s, i) => {
                const h = (s.cantidad / max) * 56;
                const x = i * 20 + 2;
                const y = 60 - h;
                return (
                  <g key={s.mes}>
                    <motion.rect
                      initial={{ height: 0, y: 60 }}
                      animate={{ height: h, y }}
                      transition={{ delay: i * 0.02, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      x={x}
                      width={16}
                      rx={2}
                      fill={s.cantidad > 0 ? color : 'hsl(var(--border))'}
                      opacity={s.cantidad > 0 ? 0.85 : 0.3}
                    />
                    {s.cantidad > 0 && (
                      <text
                        x={x + 8}
                        y={y - 2}
                        textAnchor="middle"
                        fontSize="7"
                        fill="hsl(var(--text-muted))"
                        fontWeight="600"
                      >
                        {s.cantidad}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="flex justify-between mt-1 text-[8px] text-[hsl(var(--text-muted))] tabular-nums">
              <span>{etiquetaMes(serie[0]?.mes ?? '')}</span>
              <span>{etiquetaMes(serie[serie.length - 1]?.mes ?? '')}</span>
            </div>
            {total === 0 && (
              <p className="text-[10px] text-[hsl(var(--text-muted))] mt-2 italic text-center">
                Sin ventas registradas en el período.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
