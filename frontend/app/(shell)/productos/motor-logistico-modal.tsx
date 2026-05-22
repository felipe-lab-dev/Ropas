'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Zap, BookOpen, ChevronRight, Loader2, Trophy, Award, Medal, BarChart3 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { postear, mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type Clase = 'AA' | 'A' | 'B' | 'C' | 'D';

interface TopProducto {
  id: string;
  sku: string;
  codigo: string | null;
  nombre: string;
  unidades: number;
  margen: number;
  frecuencia: number;
  recencia: number;
  tendencia: number;
  rotacion: number;
  score: number;
}

interface ResultadoMotor {
  ejecutadoEn: string;
  productosTotales: number;
  productosClasificados: number;
  distribucion: Record<Clase, number>;
  topPorClase: Record<Clase, TopProducto[]>;
  parametros: {
    mesesLookback: number;
    mesesTendencia: number;
    porcentajes: Record<Clase, number>;
    pesos: {
      unidades: number; margen: number; frecuencia: number;
      recencia: number; tendencia: number; rotacion: number;
    };
  };
}

interface VariableDef {
  id: keyof ResultadoMotor['parametros']['pesos'];
  label: string;
  pct: string;
  desc: string;
  detalle: string;
}

const VARIABLES: VariableDef[] = [
  { id: 'unidades',   label: 'Unidades',   pct: '25%', desc: 'Volumen vendido', detalle: 'Total de unidades vendidas en los últimos 12 meses.' },
  { id: 'margen',     label: 'Margen',     pct: '20%', desc: 'Rentabilidad',    detalle: '(Precio − Costo) × unidades vendidas. Mide cuánto deja el producto.' },
  { id: 'frecuencia', label: 'Frecuencia', pct: '15%', desc: 'Constancia',      detalle: '% de meses con al menos una venta. Diferencia a los productos regulares de los esporádicos.' },
  { id: 'tendencia',  label: 'Tendencia',  pct: '15%', desc: 'Crecimiento',     detalle: 'Compara unidades de los últimos 3 meses vs los 3 meses previos. Premia productos en alza.' },
  { id: 'rotacion',   label: 'Rotación',   pct: '15%', desc: 'Velocidad',       detalle: 'Unidades vendidas / (stock disponible + unidades). Mide qué tan rápido se vacía el stock.' },
  { id: 'recencia',   label: 'Recencia',   pct: '10%', desc: 'Frescura',        detalle: '1 = vendido hoy, 0 = hace 12 meses. Castiga productos estancados.' },
];

const COLORES_CLASE: Record<Clase, { base: string; suave: string; texto: string }> = {
  AA: { base: '#8b5cf6', suave: 'rgba(139,92,246,0.12)', texto: 'Las joyas — máximo cuidado' },
  A:  { base: '#0ea5e9', suave: 'rgba(14,165,233,0.12)', texto: 'Pilares del catálogo' },
  B:  { base: '#22c55e', suave: 'rgba(34,197,94,0.12)', texto: 'Sólidos, demanda estable' },
  C:  { base: '#f59e0b', suave: 'rgba(245,158,11,0.12)', texto: 'Baja rotación, evaluar promo' },
  D:  { base: '#94a3b8', suave: 'rgba(148,163,184,0.12)', texto: 'Cola larga / sin movimiento' },
};

const ICONOS_CLASE: Record<Clase, React.ElementType> = {
  AA: Trophy,
  A:  Award,
  B:  Medal,
  C:  BarChart3,
  D:  BarChart3,
};

export function MotorLogisticoModal({
  abierto,
  onAbiertoChange,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [vista, setVista] = React.useState<'inicio' | 'resultados' | 'manual'>('inicio');
  const [resultado, setResultado] = React.useState<ResultadoMotor | null>(null);

  const calcular = useMutation({
    mutationFn: () => postear<ResultadoMotor>('/productos/motor-logistico/calcular', {}),
    onSuccess: r => {
      setResultado(r);
      setVista('resultados');
      void qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success(`Clasificación completa: ${r.productosClasificados} productos`);
    },
    onError: e => toast.error(mensajeError(e)),
  });

  React.useEffect(() => {
    if (!abierto) {
      setTimeout(() => { setVista('inicio'); setResultado(null); }, 300);
    }
  }, [abierto]);

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {/* Header con gradiente */}
        <div className="relative bg-gradient-to-br from-[hsl(var(--brand-primary))] via-[#a855f7] to-[#ec4899] text-white p-6 pb-5">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 80%, white 0%, transparent 40%)',
          }} />
          <div className="relative flex items-center gap-3">
            <motion.div
              animate={{ rotate: calcular.isPending ? 360 : 0 }}
              transition={calcular.isPending ? { duration: 2, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}
              className="size-12 rounded-2xl bg-white/15 backdrop-blur-sm grid place-items-center border border-white/20"
            >
              <Zap className="size-6 text-white drop-shadow" />
            </motion.div>
            <div className="flex-1">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight text-white">
                  Motor Logístico
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs">
                  Clasificación ABC multi-variable (AA · A · B · C · D)
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          {/* Tabs */}
          <div className="relative flex gap-1 mt-4 -mb-1">
            {(['inicio', 'resultados', 'manual'] as const).map(t => {
              const activo = vista === t;
              const habilitado = t !== 'resultados' || !!resultado;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!habilitado}
                  onClick={() => setVista(t)}
                  className={cn(
                    'relative px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all',
                    activo ? 'bg-[hsl(var(--surface))] text-[hsl(var(--text))]' : 'text-white/70 hover:text-white',
                    !habilitado && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {t === 'inicio' && 'Calcular'}
                  {t === 'resultados' && 'Resultados'}
                  {t === 'manual' && (<><BookOpen className="size-3 inline mr-1 -mt-0.5" />Manual</>)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="wait">
            {vista === 'inicio' && (
              <motion.div
                key="inicio"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="text-center space-y-3 py-4">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                    className="size-20 mx-auto rounded-3xl bg-gradient-to-br from-[hsl(var(--brand-primary))]/20 to-[hsl(var(--brand-primary))]/5 grid place-items-center"
                  >
                    <Sparkles className="size-10 text-[hsl(var(--brand-primary))]" />
                  </motion.div>
                  <h3 className="text-lg font-bold">Asignar clasificación ABC a tu catálogo</h3>
                  <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mx-auto">
                    El motor analiza ventas, margen y actividad de los últimos 12 meses
                    y asigna a cada producto una clase entre <b>AA</b> (top 6%) y <b>D</b> (cola larga).
                  </p>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[hsl(var(--text-muted))] mb-2 text-center">
                    6 variables ponderadas
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VARIABLES.map((v, i) => (
                      <motion.div
                        key={v.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 + i * 0.04 }}
                        className="p-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/30"
                      >
                        <div className="flex items-baseline justify-between">
                          <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-muted))] font-bold">{v.label}</div>
                          <div className="text-sm font-bold text-[hsl(var(--brand-primary))] tabular-nums">{v.pct}</div>
                        </div>
                        <div className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">{v.desc}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={() => calcular.mutate()}
                  disabled={calcular.isPending}
                >
                  {calcular.isPending ? (
                    <><Loader2 className="size-4 animate-spin" /> Calculando…</>
                  ) : (
                    <><Zap className="size-4" /> Ejecutar Motor Logístico</>
                  )}
                </Button>
                <p className="text-[10px] text-center text-[hsl(var(--text-muted))]">
                  Reemplaza la clasificación actual de todos los productos activos.
                </p>
              </motion.div>
            )}

            {vista === 'resultados' && resultado && (
              <motion.div
                key="resultados"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="text-center text-xs text-[hsl(var(--text-muted))]">
                  Clasificados <b>{resultado.productosClasificados}</b> de {resultado.productosTotales} productos
                  · {new Date(resultado.ejecutadoEn).toLocaleString('es-PE')}
                </div>

                {/* Distribución en barras */}
                <div className="space-y-2.5">
                  {(['AA', 'A', 'B', 'C', 'D'] as Clase[]).map((clase, idx) => {
                    const cant = resultado.distribucion[clase];
                    const pctReal = resultado.productosTotales > 0
                      ? (cant / resultado.productosTotales) * 100 : 0;
                    const c = COLORES_CLASE[clase];
                    const Icono = ICONOS_CLASE[clase];
                    return (
                      <motion.div
                        key={clase}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        className="flex items-center gap-3"
                      >
                        <div
                          className="size-9 rounded-lg grid place-items-center font-bold text-xs shrink-0"
                          style={{ background: c.suave, color: c.base, border: `1px solid ${c.base}40` }}
                        >
                          <Icono className="size-4" />
                        </div>
                        <div className="w-8 text-sm font-bold tabular-nums" style={{ color: c.base }}>{clase}</div>
                        <div className="flex-1 relative h-7 rounded-md bg-[hsl(var(--surface-2))]/40 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pctReal}%` }}
                            transition={{ delay: 0.1 + idx * 0.06, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                            className="h-full rounded-md"
                            style={{ background: `linear-gradient(90deg, ${c.base}cc, ${c.base})` }}
                          />
                          <div className="absolute inset-0 flex items-center px-3 text-[11px] font-semibold mix-blend-difference text-white">
                            {c.texto}
                          </div>
                        </div>
                        <div className="w-20 text-right text-sm tabular-nums">
                          <span className="font-bold">{cant}</span>
                          <span className="text-[hsl(var(--text-muted))] text-[10px] ml-1">
                            ({pctReal.toFixed(0)}%)
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Top 5 por clase */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] uppercase tracking-wider font-bold text-[hsl(var(--text-muted))]">
                    Top productos por clase
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(['AA', 'A'] as Clase[]).map(clase => {
                      const top = resultado.topPorClase[clase];
                      if (!top || top.length === 0) return null;
                      const c = COLORES_CLASE[clase];
                      return (
                        <div
                          key={clase}
                          className="p-3 rounded-xl border"
                          style={{ borderColor: `${c.base}40`, background: c.suave }}
                        >
                          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: c.base }}>
                            Clase {clase}
                          </div>
                          <ul className="space-y-1">
                            {top.map((p, i) => (
                              <li key={p.id} className="text-xs flex items-center gap-1.5">
                                <span className="text-[hsl(var(--text-muted))] tabular-nums w-4">{i + 1}.</span>
                                <span className="font-medium truncate flex-1">{p.nombre}</span>
                                <span className="text-[hsl(var(--text-muted))] tabular-nums">{p.unidades}u</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setVista('inicio')}>
                    Volver
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setVista('manual')}>
                    <BookOpen className="size-4" /> ¿Cómo funciona?
                  </Button>
                  <Button className="flex-1" onClick={() => onAbiertoChange(false)}>
                    Listo
                  </Button>
                </div>
              </motion.div>
            )}

            {vista === 'manual' && (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="space-y-5 text-sm"
              >
                <section className="space-y-2">
                  <h3 className="font-bold text-base">¿Qué hace el Motor Logístico?</h3>
                  <p className="text-[hsl(var(--text-muted))] leading-relaxed">
                    Analiza los últimos 12 meses de ventas de tu catálogo y asigna a cada
                    producto una clasificación ABC (<b>AA · A · B · C · D</b>) basada en un
                    score multi-variable. Esto te permite priorizar reposición, espacio en
                    vitrina, promociones y descuentos en los productos correctos.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="font-bold text-base">Fórmula del score</h3>
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/30 p-3 font-mono text-xs leading-relaxed">
                    score =&nbsp;&nbsp;0.25 × <span className="text-[hsl(var(--brand-primary))]">unidades</span><br />
                    {'        '}+ 0.20 × <span className="text-[hsl(var(--brand-primary))]">margen</span><br />
                    {'        '}+ 0.15 × <span className="text-[hsl(var(--brand-primary))]">frecuencia</span><br />
                    {'        '}+ 0.15 × <span className="text-[hsl(var(--brand-primary))]">tendencia</span><br />
                    {'        '}+ 0.15 × <span className="text-[hsl(var(--brand-primary))]">rotación</span><br />
                    {'        '}+ 0.10 × <span className="text-[hsl(var(--brand-primary))]">recencia</span>
                  </div>
                  <div className="space-y-2 pt-1">
                    {VARIABLES.map(v => (
                      <div key={v.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--brand-primary))]/10 text-[hsl(var(--brand-primary))] font-bold tabular-nums">
                            {v.pct}
                          </span>
                          <b className="text-[hsl(var(--text))]">{v.label}</b>
                        </div>
                        <p className="text-[hsl(var(--text-muted))] mt-0.5 ml-12">{v.detalle}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[hsl(var(--text-muted))] italic pt-1">
                    Las variables monetarias (unidades, margen) se normalizan a [0, 1] dividiendo
                    por el máximo del catálogo. Las demás ya viven naturalmente en [0, 1].
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="font-bold text-base">Distribución de clases</h3>
                  <p className="text-xs text-[hsl(var(--text-muted))]">
                    Los productos con ventas se ordenan por score y se reparten en proporción
                    fija (estilo Pareto):
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {(['AA', 'A', 'B', 'C', 'D'] as Clase[]).map(clase => {
                      const c = COLORES_CLASE[clase];
                      const pct = { AA: 6, A: 14, B: 20, C: 27, D: 33 }[clase];
                      return (
                        <div key={clase} className="text-center p-2 rounded-lg border" style={{ borderColor: `${c.base}40`, background: c.suave }}>
                          <div className="text-lg font-bold" style={{ color: c.base }}>{clase}</div>
                          <div className="text-[10px] text-[hsl(var(--text-muted))]">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[hsl(var(--text-muted))]">
                    Los productos <b>sin ventas</b> en el período caen automáticamente en clase{' '}
                    <b>D</b>. Productos eliminados o inactivos no se clasifican.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="font-bold text-base">Cómo interpretarlo</h3>
                  <div className="space-y-1.5">
                    {(['AA', 'A', 'B', 'C', 'D'] as Clase[]).map(clase => {
                      const c = COLORES_CLASE[clase];
                      return (
                        <div key={clase} className="flex items-start gap-2 text-xs">
                          <span
                            className="font-bold tabular-nums shrink-0 w-8 text-center rounded px-1"
                            style={{ background: c.suave, color: c.base, border: `1px solid ${c.base}40` }}
                          >
                            {clase}
                          </span>
                          <span className="text-[hsl(var(--text-muted))] leading-relaxed">{c.texto}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="font-bold text-base">Recomendación de uso</h3>
                  <ul className="text-xs space-y-1.5 text-[hsl(var(--text-muted))] pl-4 list-disc">
                    <li><b>AA + A</b>: priorizar stock, evitar quiebres, vitrina principal.</li>
                    <li><b>B</b>: stock saludable, reseñas si aplica.</li>
                    <li><b>C</b>: evaluar promoción, combo o liquidación parcial.</li>
                    <li><b>D</b>: candidatos a remate o descontinuar — no inmovilizar capital.</li>
                  </ul>
                  <p className="text-xs text-[hsl(var(--text-muted))] italic">
                    Recomendamos correr el motor cada inicio de mes o cuando hagas cambios
                    grandes de catálogo.
                  </p>
                </section>

                <Button variant="outline" className="w-full" onClick={() => setVista(resultado ? 'resultados' : 'inicio')}>
                  <ChevronRight className="size-4 rotate-180" /> Volver
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
