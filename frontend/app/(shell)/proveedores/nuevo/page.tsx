'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { postear, mensajeError } from '@/lib/api/client';

interface Form {
  tipoDocumento: 'ruc' | 'dni' | 'otro';
  documento: string;
  razonSocial: string;
  nombreComercial: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  condicionPago: 'contado' | 'credito_15' | 'credito_30' | 'credito_60' | 'credito_otro';
  diasCredito: number;
  cuentaBancaria: string;
  notas: string;
}

const VACIO: Form = {
  tipoDocumento: 'ruc',
  documento: '',
  razonSocial: '',
  nombreComercial: '',
  contacto: '',
  email: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  condicionPago: 'contado',
  diasCredito: 0,
  cuentaBancaria: '',
  notas: '',
};

export default function NuevoProveedorPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<Form>(VACIO);
  const [error, setError] = React.useState<string | null>(null);

  const mutar = useMutation({
    mutationFn: () => postear('/proveedores', form),
    onSuccess: () => router.push('/proveedores'),
    onError: e => setError(mensajeError(e)),
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Nuevo proveedor"
        descripcion="Registra los datos fiscales y de contacto."
        acciones={
          <Button variant="ghost" asChild>
            <Link href="/proveedores"><ArrowLeft className="size-4" /> Volver</Link>
          </Button>
        }
      />

      <Card className="p-6 space-y-5 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Tipo doc.</label>
            <select
              className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
              value={form.tipoDocumento}
              onChange={e => set('tipoDocumento', e.target.value as Form['tipoDocumento'])}
            >
              <option value="ruc">RUC</option>
              <option value="dni">DNI</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Documento</label>
            <Input value={form.documento} onChange={e => set('documento', e.target.value)} placeholder="20123456789" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Razón social *</label>
          <Input value={form.razonSocial} onChange={e => set('razonSocial', e.target.value)} placeholder="DISTRIBUIDORA TEXTIL SAC" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Nombre comercial</label>
          <Input value={form.nombreComercial} onChange={e => set('nombreComercial', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Contacto</label>
            <Input value={form.contacto} onChange={e => set('contacto', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Teléfono</label>
            <Input value={form.telefono} onChange={e => set('telefono', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Email</label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Ciudad</label>
            <Input value={form.ciudad} onChange={e => set('ciudad', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Dirección</label>
          <Input value={form.direccion} onChange={e => set('direccion', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Condición de pago</label>
            <select
              className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
              value={form.condicionPago}
              onChange={e => set('condicionPago', e.target.value as Form['condicionPago'])}
            >
              <option value="contado">Contado</option>
              <option value="credito_15">Crédito 15 días</option>
              <option value="credito_30">Crédito 30 días</option>
              <option value="credito_60">Crédito 60 días</option>
              <option value="credito_otro">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Días crédito</label>
            <Input type="number" value={form.diasCredito} onChange={e => set('diasCredito', Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Cuenta bancaria</label>
            <Input value={form.cuentaBancaria} onChange={e => set('cuentaBancaria', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">Notas</label>
          <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={3} />
        </div>

        {error && (
          <div className="rounded-lg border border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)] p-3 text-sm text-[hsl(355_75%_70%)]">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" asChild><Link href="/proveedores">Cancelar</Link></Button>
          <Button
            size="lg"
            disabled={!form.razonSocial || !form.documento || mutar.isPending}
            onClick={() => mutar.mutate()}
          >
            <Save className="size-4" /> Guardar proveedor
          </Button>
        </div>
      </Card>
    </div>
  );
}
