'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { postear, mensajeError } from '@/lib/api/client';
import { SelectorUbigeo } from '@/components/sunat/selector-ubigeo';

const TIPO_DOC = [
  { value: 'dni', label: 'DNI' },
  { value: 'ruc', label: 'RUC' },
  { value: 'carne_extranjeria', label: 'Carné de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'otro', label: 'Otro' },
] as const;

export default function NuevoClientePage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [tipoDocumento, setTipoDocumento] = React.useState<string>('dni');
  const [documento, setDocumento] = React.useState('');
  const [nombre, setNombre] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [telefono, setTelefono] = React.useState('');
  const [direccion, setDireccion] = React.useState('');
  const [ciudad, setCiudad] = React.useState('');
  const [ubigeoCodigo, setUbigeoCodigo] = React.useState<string | undefined>(undefined);
  const [fechaNacimiento, setFechaNacimiento] = React.useState('');
  const [notas, setNotas] = React.useState('');

  const crear = useMutation({
    mutationFn: async () => {
      const body = {
        tipoDocumento,
        documento: documento.trim() || undefined,
        nombre: nombre.trim(),
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
        direccion: direccion.trim() || undefined,
        ciudad: ciudad.trim() || undefined,
        ubigeoCodigo: ubigeoCodigo ?? undefined,
        fechaNacimiento: fechaNacimiento || undefined,
        notas: notas.trim() || undefined,
      };
      return postear<{ id: string }>('/clientes', body);
    },
    onSuccess: cliente => {
      toast.success('Cliente creado');
      void qc.invalidateQueries({ queryKey: ['clientes'] });
      router.push(`/clientes/${cliente.id}`);
    },
    onError: e => toast.error(mensajeError(e)),
  });

  function validar(): string | null {
    if (!nombre.trim()) return 'Nombre requerido';
    if (nombre.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
    return null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validar();
    if (err) { toast.error(err); return; }
    crear.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <PageHeader
        titulo="Nuevo cliente"
        descripcion="Registra los datos del cliente para llevar el control de sus compras."
        acciones={
          <>
            <Button asChild variant="ghost" type="button">
              <Link href="/clientes"><ArrowLeft className="size-4" /> Cancelar</Link>
            </Button>
            <Button type="submit" size="lg" disabled={crear.isPending}>
              {crear.isPending ? 'Guardando…' : 'Crear cliente'}
            </Button>
          </>
        }
      />

      {/* Identificación */}
      <Card className="p-6 space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
          Identificación
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="tipoDocumento">Tipo de documento</Label>
            <Select
              id="tipoDocumento"
              value={tipoDocumento}
              onChange={e => setTipoDocumento(e.target.value)}
            >
              {TIPO_DOC.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="documento">Número de documento</Label>
            <Input
              id="documento"
              value={documento}
              onChange={e => setDocumento(e.target.value)}
              placeholder={tipoDocumento === 'ruc' ? '20123456789' : '12345678'}
              inputMode="numeric"
            />
          </div>
          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
            <Input
              id="fechaNacimiento"
              type="date"
              value={fechaNacimiento}
              onChange={e => setFechaNacimiento(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre completo *</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="María García López"
            required
            autoFocus
          />
        </div>
      </Card>

      {/* Contacto */}
      <Card className="p-6 space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
          Contacto
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="maria@ejemplo.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="987654321"
              inputMode="tel"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="direccion">Dirección</Label>
          <Input
            id="direccion"
            value={direccion}
            onChange={e => setDireccion(e.target.value)}
            placeholder="Av. Principal 123, Apt. 4B"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input
              id="ciudad"
              value={ciudad}
              onChange={e => setCiudad(e.target.value)}
              placeholder="Cusco"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ubigeo">Ubigeo SUNAT</Label>
            <SelectorUbigeo
              value={ubigeoCodigo}
              onChange={setUbigeoCodigo}
              placeholder="Buscar distrito, provincia…"
            />
            <p className="text-[10px] text-[hsl(var(--text-muted))]">
              Requerido para emitir facturas a clientes con RUC.
            </p>
          </div>
        </div>
      </Card>

      {/* Notas */}
      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
          Notas internas
        </h2>
        <Textarea
          id="notas"
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Preferencias, observaciones, historial relevante…"
          rows={3}
        />
      </Card>
    </form>
  );
}
