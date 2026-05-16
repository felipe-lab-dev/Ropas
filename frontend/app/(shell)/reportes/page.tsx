'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { obtener } from '@/lib/api/client';
import { formatearMoneda, formatearNumero } from '@/lib/utils';

interface CategoriaVenta { categoria: string; monto: number; unidades: number }

export default function ReportesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ventas-por-categoria'],
    queryFn: () => obtener<CategoriaVenta[]>('/reportes/ventas-por-categoria?dias=30'),
  });

  const max = (data ?? []).reduce((m, c) => Math.max(m, c.monto), 0) || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-[hsl(var(--text-muted))]">Analítica de ventas e inventario.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-[hsl(var(--brand-primary))]" /> Ventas por categoría · últimos 30 días
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)
          ) : (data ?? []).length === 0 ? (
            <p className="text-sm text-[hsl(var(--text-muted))] py-8 text-center">
              Sin datos suficientes para generar el reporte.
            </p>
          ) : (
            data!.map((c, i) => {
              const pct = (c.monto / max) * 100;
              return (
                <motion.div
                  key={c.categoria}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.categoria}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[hsl(var(--text-muted))]">{formatearNumero(c.unidades)} unidades</span>
                      <span className="font-bold tabular-nums">{formatearMoneda(c.monto)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[hsl(var(--surface-2))] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.1 + i * 0.05, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))]"
                    />
                  </div>
                </motion.div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
