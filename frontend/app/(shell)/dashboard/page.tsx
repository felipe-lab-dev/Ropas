'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp, ShoppingBag, Users, Package, AlertTriangle, ArrowUpRight,
} from 'lucide-react';
import { obtener } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatearMoneda, formatearNumero } from '@/lib/utils';

interface Resumen {
  totales: { productos: number; clientes: number };
  ventas: {
    hoy: { monto: number; cantidad: number };
    semana: { monto: number; cantidad: number };
    mes: { monto: number; cantidad: number };
  };
  stockBajo: Array<{
    id: string;
    disponible: number;
    sucursal: { nombre: string };
    variante: { talla: string; color: string; producto: { nombre: string; sku: string } };
  }>;
  topVendidos: Array<{
    nombre: string;
    talla: string;
    color: string;
    unidades: number;
  }>;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => obtener<Resumen>('/reportes/dashboard'),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-[hsl(var(--text-muted))]">Resumen de tu tienda hoy.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricaHero
          label="Ventas hoy"
          valor={isLoading ? null : formatearMoneda(data!.ventas.hoy.monto)}
          sublabel={isLoading ? null : `${data!.ventas.hoy.cantidad} ticket${data!.ventas.hoy.cantidad === 1 ? '' : 's'}`}
          icon={ShoppingBag}
          color="brand"
          delay={0}
        />
        <MetricaHero
          label="Ventas semana"
          valor={isLoading ? null : formatearMoneda(data!.ventas.semana.monto)}
          sublabel={isLoading ? null : `${data!.ventas.semana.cantidad} ventas`}
          icon={TrendingUp}
          color="accent"
          delay={0.05}
        />
        <MetricaHero
          label="Productos activos"
          valor={isLoading ? null : formatearNumero(data!.totales.productos)}
          sublabel="en catálogo"
          icon={Package}
          color="success"
          delay={0.1}
        />
        <MetricaHero
          label="Clientes"
          valor={isLoading ? null : formatearNumero(data!.totales.clientes)}
          sublabel="registrados"
          icon={Users}
          color="warning"
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">Top vendidos</CardTitle>
                <p className="text-xs text-[hsl(var(--text-muted))] mt-1">Últimas semanas</p>
              </div>
              <Badge variant="accent">5 más vendidos</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : data!.topVendidos.length === 0 ? (
              <p className="text-sm text-[hsl(var(--text-muted))] py-6 text-center">
                Aún sin ventas registradas.
              </p>
            ) : (
              data!.topVendidos.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-[hsl(var(--surface-2))]/50 transition-colors"
                >
                  <div className="size-9 rounded-md bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] grid place-items-center text-white font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.nombre}</div>
                    <div className="text-xs text-[hsl(var(--text-muted))]">
                      Talla {p.talla} · {p.color}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">{p.unidades}</div>
                    <div className="text-[10px] text-[hsl(var(--text-muted))] uppercase">unidades</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">Stock bajo</CardTitle>
                <p className="text-xs text-[hsl(var(--text-muted))] mt-1">Reponer pronto</p>
              </div>
              <Badge variant="danger">
                <AlertTriangle className="size-3 mr-1" />
                Crítico
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : data!.stockBajo.length === 0 ? (
              <p className="text-sm text-[hsl(var(--text-muted))] py-6 text-center">
                Todo el stock está bien. ✓
              </p>
            ) : (
              data!.stockBajo.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-[hsl(var(--surface-2))]/50 transition-colors"
                >
                  <div className="size-9 rounded-md bg-[hsl(var(--brand-danger))]/15 text-[hsl(var(--brand-danger))] grid place-items-center font-bold text-sm tabular-nums">
                    {s.disponible}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.variante.producto.nombre}
                    </div>
                    <div className="text-xs text-[hsl(var(--text-muted))]">
                      {s.variante.talla} · {s.variante.color} · {s.sucursal.nombre}
                    </div>
                  </div>
                  <ArrowUpRight className="size-4 text-[hsl(var(--text-muted))]" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricaHeroProps {
  label: string;
  valor: string | null;
  sublabel: string | null;
  icon: React.ElementType;
  color: 'brand' | 'accent' | 'success' | 'warning';
  delay: number;
}

function MetricaHero({ label, valor, sublabel, icon: Icon, color, delay }: MetricaHeroProps) {
  const tonos: Record<typeof color, { bg: string; text: string; ring: string }> = {
    brand: {
      bg: 'from-[hsl(var(--brand-primary))]/15',
      text: 'text-[hsl(var(--brand-primary))]',
      ring: 'ring-[hsl(var(--brand-primary))]/20',
    },
    accent: {
      bg: 'from-[hsl(var(--brand-accent))]/15',
      text: 'text-[hsl(var(--brand-accent))]',
      ring: 'ring-[hsl(var(--brand-accent))]/20',
    },
    success: {
      bg: 'from-[hsl(var(--brand-success))]/15',
      text: 'text-[hsl(var(--brand-success))]',
      ring: 'ring-[hsl(var(--brand-success))]/20',
    },
    warning: {
      bg: 'from-[hsl(var(--brand-warning))]/15',
      text: 'text-[hsl(var(--brand-warning))]',
      ring: 'ring-[hsl(var(--brand-warning))]/20',
    },
  }[color] as any;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className={`bg-gradient-to-br ${tonos.bg} via-transparent to-transparent overflow-hidden`}>
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))] font-medium">
              {label}
            </span>
            <div className={`size-8 rounded-md grid place-items-center ${tonos.text} bg-[hsl(var(--surface-2))]`}>
              <Icon className="size-4" />
            </div>
          </div>
          {valor === null ? (
            <Skeleton className="h-9 w-32 mb-1" />
          ) : (
            <div className="text-3xl font-black tracking-tight tabular-nums">
              {valor}
            </div>
          )}
          {sublabel === null ? (
            <Skeleton className="h-3 w-20 mt-2" />
          ) : (
            <div className="text-xs text-[hsl(var(--text-muted))] mt-1">{sublabel}</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
