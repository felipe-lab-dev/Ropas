'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wallet, Lock, Unlock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { obtener, postear, mensajeError } from '@/lib/api/client';
import { formatearFecha, formatearMoneda } from '@/lib/utils';
import { useSesion } from '@/lib/store/sesion';

interface Sucursal { id: string; nombre: string }
interface SesionCaja {
  id: string; estado: 'abierta' | 'cerrada' | 'con_diferencia';
  montoApertura: string; abiertaEn: string;
  cerradaEn?: string | null; montoCierre?: string | null;
}

export default function CajaPage() {
  const usuario = useSesion(s => s.usuario);
  const qc = useQueryClient();
  const [sucursalId, setSucursalId] = React.useState<string>(usuario?.sucursalDefecto ?? '');
  const [montoApertura, setMontoApertura] = React.useState('');
  const [montoCierre, setMontoCierre] = React.useState('');

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  React.useEffect(() => {
    if (sucursales && !sucursalId && sucursales[0]) setSucursalId(sucursales[0].id);
  }, [sucursales, sucursalId]);

  const { data: sesion } = useQuery({
    queryKey: ['caja-mi-sesion', sucursalId],
    queryFn: () => obtener<SesionCaja | null>(`/caja/mi-sesion-abierta?sucursalId=${sucursalId}`),
    enabled: !!sucursalId,
  });

  const abrir = useMutation({
    mutationFn: () =>
      postear<SesionCaja>('/caja/abrir', { sucursalId, montoApertura: parseFloat(montoApertura) }),
    onSuccess: () => {
      toast.success('Caja abierta');
      setMontoApertura('');
      qc.invalidateQueries({ queryKey: ['caja-mi-sesion'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const cerrar = useMutation({
    mutationFn: () =>
      postear<SesionCaja>(`/caja/${sesion!.id}/cerrar`, { montoCierre: parseFloat(montoCierre) }),
    onSuccess: () => {
      toast.success('Caja cerrada');
      setMontoCierre('');
      qc.invalidateQueries({ queryKey: ['caja-mi-sesion'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Caja</h1>
        <p className="text-[hsl(var(--text-muted))]">Apertura, cierre y arqueo.</p>
      </div>

      {sesion ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-md bg-[hsl(var(--brand-success))]/15 text-[hsl(var(--brand-success))] grid place-items-center">
                    <Unlock className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Sesión abierta</CardTitle>
                    <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                      Desde {formatearFecha(sesion.abiertaEn, 'completa')}
                    </p>
                  </div>
                </div>
                <Badge variant="success">Activa</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6 py-4 border-y border-[hsl(var(--border))]">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Apertura</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{formatearMoneda(sesion.montoApertura)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cierre">Monto contado al cierre</Label>
                <div className="flex gap-3">
                  <Input
                    id="cierre"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={montoCierre}
                    onChange={e => setMontoCierre(e.target.value)}
                    className="text-lg font-mono"
                  />
                  <Button
                    onClick={() => cerrar.mutate()}
                    disabled={!montoCierre || cerrar.isPending}
                    variant="danger"
                  >
                    <Lock className="size-4" /> Cerrar caja
                  </Button>
                </div>
                <p className="text-xs text-[hsl(var(--text-muted))] flex items-start gap-1.5">
                  <AlertCircle className="size-3 mt-0.5 shrink-0" />
                  Si hay diferencia con el monto esperado, la sesión queda marcada para revisión.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-md bg-[hsl(var(--text-muted))]/15 text-[hsl(var(--text-muted))] grid place-items-center">
                  <Wallet className="size-4" />
                </div>
                <div>
                  <CardTitle>Caja cerrada</CardTitle>
                  <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                    Para vender necesitás abrir una sesión.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apertura">Monto inicial en caja</Label>
                <div className="flex gap-3">
                  <Input
                    id="apertura"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={montoApertura}
                    onChange={e => setMontoApertura(e.target.value)}
                    className="text-lg font-mono"
                  />
                  <Button onClick={() => abrir.mutate()} disabled={!montoApertura || abrir.isPending}>
                    <Unlock className="size-4" /> Abrir caja
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
