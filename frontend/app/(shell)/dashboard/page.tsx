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
import { PageHeader } from '@/components/ui/page-header';
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
      <PageHeader
        titulo="Dashboard"
        descripcion="Resumen en tiempo real de tu tienda."
      />

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
          delay={0.06}
        />
        <MetricaHero
          label="Productos activos"
          valor={isLoading ? null : formatearNumero(data!.totales.productos)}
          sublabel="en catálogo"
          icon={Package}
          color="success"
          delay={0.12}
        />
        <MetricaHero
          label="Clientes"
          valor={isLoading ? null : formatearNumero(data!.totales.clientes)}
          sublabel="registrados"
          icon={Users}
          color="warning"
          delay={0.18}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.24 }}
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))]" />
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">Top vendidos</CardTitle>
                  <p className="text-xs text-[hsl(var(--text-muted))] mt-1">Últimas semanas</p>
                </div>
                <Badge variant="accent">5 más vendidos</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {isLoading ? (
                [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)
              ) : data!.topVendidos.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="size-12 mx-auto mb-3 rounded-xl bg-[hsl(var(--surface-2))] grid place-items-center text-[hsl(var(--text-muted))]">
                    <TrendingUp className="size-5" />
                  </div>
                  <p className="text-sm text-[hsl(var(--text-muted))]">Aún sin ventas registradas.</p>
                </div>
              ) : (
                data!.topVendidos.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(var(--surface-2))]/60 transition-colors group"
                  >
                    <div className="size-10 rounded-lg gradient-brand-accent grid place-items-center text-white font-bold text-sm shadow-md">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.nombre}</div>
                      <div className="text-xs text-[hsl(var(--text-muted))]">
                        Talla {p.talla} · {p.color}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold tabular-nums">{p.unidades}</div>
                      <div className="text-[10px] text-[hsl(var(--text-muted))] uppercase tracking-wider">und</div>
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[hsl(var(--brand-danger))] to-[hsl(var(--brand-warning))]" />
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
            <CardContent className="space-y-1.5">
              {isLoading ? (
                [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)
              ) : data!.stockBajo.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="size-12 mx-auto mb-3 rounded-xl bg-[hsl(var(--brand-success))]/12 grid place-items-center text-[hsl(var(--brand-success))]">
                    ✓
                  </div>
                  <p className="text-sm text-[hsl(var(--text-muted))]">Todo el stock está bien.</p>
                </div>
              ) : (
                data!.stockBajo.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(var(--surface-2))]/60 transition-colors group cursor-pointer"
                  >
                    <div className="size-10 rounded-lg bg-[hsl(var(--brand-danger))]/12 text-[hsl(var(--brand-danger))] grid place-items-center font-bold text-sm tabular-nums">
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
                    <ArrowUpRight className="size-4 text-[hsl(var(--text-muted))] group-hover:text-[hsl(var(--brand-primary))] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
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
  const tonos = {
    brand: {
      bg: 'from-[hsl(var(--brand-primary))]/12 to-[hsl(var(--brand-primary))]/0',
      text: 'text-[hsl(var(--brand-primary))]',
      iconBg: 'bg-[hsl(var(--brand-primary))]/15',
      bar: 'bg-gradient-to-r from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-primary-hover))]',
    },
    accent: {
      bg: 'from-[hsl(var(--brand-accent))]/12 to-[hsl(var(--brand-accent))]/0',
      text: 'text-[hsl(var(--brand-accent))]',
      iconBg: 'bg-[hsl(var(--brand-accent))]/15',
      bar: 'bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary))]',
    },
    success: {
      bg: 'from-[hsl(var(--brand-success))]/12 to-[hsl(var(--brand-success))]/0',
      text: 'text-[hsl(var(--brand-success))]',
      iconBg: 'bg-[hsl(var(--brand-success))]/15',
      bar: 'bg-gradient-to-r from-[hsl(var(--brand-success))] to-[hsl(var(--brand-accent))]',
    },
    warning: {
      bg: 'from-[hsl(var(--brand-warning))]/12 to-[hsl(var(--brand-warning))]/0',
      text: 'text-[hsl(var(--brand-warning))]',
      iconBg: 'bg-[hsl(var(--brand-warning))]/15',
      bar: 'bg-gradient-to-r from-[hsl(var(--brand-warning))] to-[hsl(var(--brand-danger))]',
    },
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -3 }}
    >
      <Card className={`bg-gradient-to-br ${tonos.bg} overflow-hidden hover:shadow-[var(--shadow-md)] transition-shadow`}>
        <div className={`h-0.5 ${tonos.bar}`} />
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[hsl(var(--text-muted))] font-semibold">
              {label}
            </span>
            <div className={`size-9 rounded-lg grid place-items-center ${tonos.text} ${tonos.iconBg}`}>
              <Icon className="size-[18px]" />
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
            <div className="text-xs text-[hsl(var(--text-muted))] mt-1.5">{sublabel}</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
