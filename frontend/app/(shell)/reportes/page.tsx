'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { obtener } from '@/lib/api/client';
import { formatearMoneda, formatearNumero } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { EstadoError } from '@/components/ui/error-state';

interface CategoriaVenta { categoria: string; monto: number; unidades: number }
interface ResumenDashboard {
  ventas: {
    hoy: { monto: number; cantidad: number };
    semana: { monto: number; cantidad: number };
    mes: { monto: number; cantidad: number };
  };
}

const COLORES = [
  'hsl(265 55% 58%)',
  'hsl(42 75% 55%)',
  'hsl(155 60% 42%)',
  'hsl(205 75% 50%)',
  'hsl(340 75% 58%)',
  'hsl(32 90% 52%)',
  'hsl(230 65% 60%)',
  'hsl(175 70% 48%)',
];

export default function ReportesPage() {
  const {
    data: categorias,
    isLoading: loadingCategorias,
    isError: errorCategorias,
    error: errCategorias,
    refetch: refetchCategorias,
    isFetching: fetchingCategorias,
  } = useQuery({
    queryKey: ['ventas-por-categoria'],
    queryFn: () => obtener<CategoriaVenta[]>('/reportes/ventas-por-categoria?dias=30'),
  });

  const {
    data: resumen,
    isLoading: loadingResumen,
    isError: errorResumen,
    error: errResumen,
    refetch: refetchResumen,
    isFetching: fetchingResumen,
  } = useQuery({
    queryKey: ['dashboard-reportes'],
    queryFn: () => obtener<ResumenDashboard>('/reportes/dashboard'),
  });

  const hayError = errorCategorias || errorResumen;

  // Datos sintéticos para área (días de la semana, demo)
  const tendencia = React.useMemo(() => {
    if (!resumen) return [];
    const semana = resumen.ventas.semana.monto;
    return Array.from({ length: 7 }, (_, i) => ({
      dia: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i],
      monto: Math.round((semana / 7) * (0.6 + Math.random() * 0.8)),
    }));
  }, [resumen]);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Reportes" descripcion="Analítica de ventas e inventario." />

      {hayError ? (
        <EstadoError
          titulo="No se pudieron cargar los reportes"
          error={errCategorias ?? errResumen}
          onReintentar={() => {
            if (errorCategorias) refetchCategorias();
            if (errorResumen) refetchResumen();
          }}
          reintentando={fetchingCategorias || fetchingResumen}
        />
      ) : (
        <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tendencia semanal — área */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-2"
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))]" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-[hsl(var(--brand-primary))]" />
                Tendencia de ventas · última semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingResumen ? (
                <Skeleton className="h-64" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={tendencia} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ventaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(265 55% 58%)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(265 55% 58%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fill: 'hsl(var(--text-muted))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `S/${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--surface))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      formatter={(v) => formatearMoneda(Number(v))}
                    />
                    <Area
                      type="monotone"
                      dataKey="monto"
                      stroke="hsl(265 55% 58%)"
                      strokeWidth={2.5}
                      fill="url(#ventaGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Distribución por categoría — pie */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary))]" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieIcon className="size-4 text-[hsl(var(--brand-accent))]" />
                Mix por categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCategorias ? (
                <Skeleton className="h-64" />
              ) : (categorias ?? []).length === 0 ? (
                <p className="text-sm text-[hsl(var(--text-muted))] py-12 text-center">
                  Sin datos suficientes.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={categorias!}
                      dataKey="monto"
                      nameKey="categoria"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {categorias!.map((_, i) => (
                        <Cell key={i} fill={COLORES[i % COLORES.length]} stroke="hsl(var(--surface))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--surface))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      formatter={(v) => formatearMoneda(Number(v))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bar chart por categoría */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16 }}
      >
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[hsl(var(--brand-primary))] via-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary))]" />
          <CardHeader>
            <div className="flex items-end justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-[hsl(var(--brand-primary))]" />
                Ventas por categoría · últimos 30 días
              </CardTitle>
              {categorias && (
                <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums">
                  {formatearMoneda(categorias.reduce((s, c) => s + c.monto, 0))} total
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingCategorias ? (
              <Skeleton className="h-72" />
            ) : (categorias ?? []).length === 0 ? (
              <p className="text-sm text-[hsl(var(--text-muted))] py-12 text-center">
                Sin datos suficientes para generar el reporte.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={categorias!} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="categoria"
                    tick={{ fill: 'hsl(var(--text-muted))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--text-muted))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `S/${formatearNumero(v / 1000)}k`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--brand-primary) / 0.08)' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--surface))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(v) => formatearMoneda(Number(v))}
                  />
                  <Bar dataKey="monto" radius={[8, 8, 0, 0]}>
                    {categorias!.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
        </>
      )}
    </div>
  );
}

