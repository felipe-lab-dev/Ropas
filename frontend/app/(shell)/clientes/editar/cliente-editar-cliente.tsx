'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { FormField } from '@/components/ui/form-field';
import { FormActions } from '@/components/ui/form-actions';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { useValidacionForm } from '@/lib/use-validacion-form';
import { obtener, actualizar, eliminar as eliminarApi, mensajeError } from '@/lib/api/client';
import { SelectorUbigeo } from '@/components/sunat/selector-ubigeo';

const TIPO_DOC = [
  { value: 'dni', label: 'DNI' },
  { value: 'ruc', label: 'RUC' },
  { value: 'carne_extranjeria', label: 'Carné de extranjería' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'otro', label: 'Otro' },
] as const;

interface ClienteDetalle {
  id: string;
  codigo: string | null;
  nombre: string;
  tipoDocumento: string;
  documento: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  ubigeoCodigo: string | null;
  fechaNacimiento: string | null;
  notas: string | null;
  clasificacion: string | null;
}

export function EditarClienteCliente() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const router = useRouter();
  const qc = useQueryClient();

  // Sin id → volver al listado (la ruta es estática /clientes/editar?id=...).
  React.useEffect(() => {
    if (!id) router.replace('/clientes');
  }, [id, router]);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => obtener<ClienteDetalle>(`/clientes/${id}`),
    enabled: !!id,
  });

  const [tipoDocumento, setTipoDocumento] = React.useState('');
  const [documento, setDocumento] = React.useState('');
  const [nombre, setNombre] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [telefono, setTelefono] = React.useState('');
  const [direccion, setDireccion] = React.useState('');
  const [ciudad, setCiudad] = React.useState('');
  const [ubigeoCodigo, setUbigeoCodigo] = React.useState<string | undefined>(undefined);
  const [fechaNacimiento, setFechaNacimiento] = React.useState('');
  const [notas, setNotas] = React.useState('');
  const [confirmAbierto, setConfirmAbierto] = React.useState(false);

  const validacion = useValidacionForm<{ nombre: string }>({
    reglas: [
      {
        id: 'nombre',
        label: 'Nombre completo',
        validar: d => d.nombre.trim() ? null : 'El nombre es obligatorio',
      },
    ],
  });

  React.useEffect(() => {
    if (cliente) {
      setTipoDocumento(cliente.tipoDocumento ?? 'dni');
      setDocumento(cliente.documento ?? '');
      setNombre(cliente.nombre ?? '');
      setEmail(cliente.email ?? '');
      setTelefono(cliente.telefono ?? '');
      setDireccion(cliente.direccion ?? '');
      setCiudad(cliente.ciudad ?? '');
      setUbigeoCodigo(cliente.ubigeoCodigo ?? undefined);
      setFechaNacimiento(
        cliente.fechaNacimiento ? cliente.fechaNacimiento.slice(0, 10) : '',
      );
      setNotas(cliente.notas ?? '');
    }
  }, [cliente]);

  const guardar = useMutation({
    mutationFn: () =>
      actualizar(`/clientes/${id}`, {
        tipoDocumento,
        documento: documento.trim() || null,
        nombre: nombre.trim(),
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        ciudad: ciudad.trim() || null,
        ubigeoCodigo: ubigeoCodigo ?? null,
        fechaNacimiento: fechaNacimiento || null,
        notas: notas.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Cliente actualizado');
      void qc.invalidateQueries({ queryKey: ['clientes'] });
      void qc.invalidateQueries({ queryKey: ['cliente', id] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const borrar = useMutation({
    mutationFn: () => eliminarApi(`/clientes/${id}`),
    onSuccess: () => {
      toast.success('Cliente eliminado');
      void qc.invalidateQueries({ queryKey: ['clientes'] });
      router.push('/clientes');
    },
    onError: e => toast.error(mensajeError(e)),
  });

  if (isLoading || !cliente) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const onGuardar = () => {
    const r = validacion.validar({ nombre });
    if (!r.valido) return;
    guardar.mutate();
  };

  return (
    <form
      onSubmit={e => { e.preventDefault(); onGuardar(); }}
      className="space-y-6 max-w-3xl"
    >
      <PageHeader
        titulo={cliente.nombre}
        descripcion={
          cliente.documento
            ? `${cliente.tipoDocumento.toUpperCase()} ${cliente.documento}${cliente.codigo ? ` · ${cliente.codigo}` : ''}`
            : cliente.codigo ?? 'Sin documento registrado'
        }
        acciones={
          <Button asChild variant="ghost" type="button">
            <Link href="/clientes"><ArrowLeft className="size-4" /> Volver</Link>
          </Button>
        }
      />

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

        <FormField
          label="Nombre completo"
          htmlFor="nombre"
          requerido
          error={validacion.errores.nombre}
        >
          <Input
            id="nombre"
            value={nombre}
            onChange={e => { setNombre(e.target.value); validacion.limpiarError('nombre'); }}
            required
          />
        </FormField>
      </Card>

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
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
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
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input
              id="ciudad"
              value={ciudad}
              onChange={e => setCiudad(e.target.value)}
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

      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
          Notas internas
        </h2>
        <Textarea
          id="notas"
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={3}
        />
      </Card>

      <FormActions
        onGuardar={onGuardar}
        guardando={guardar.isPending}
        onCancelar={() => router.push('/clientes')}
        onEliminar={() => setConfirmAbierto(true)}
        eliminando={borrar.isPending}
        textoGuardar="Guardar cambios"
        textoEliminar="Eliminar cliente"
      />

      <DeleteConfirmDialog
        abierto={confirmAbierto}
        onAbiertoChange={setConfirmAbierto}
        titulo="Eliminar cliente"
        nombreItem={cliente.nombre}
        descripcion={
          <>
            Soft-delete. El historial de compras se conserva.
            {' '}Se eliminará <strong className="text-[hsl(var(--text))]">{cliente.nombre}</strong>.
          </>
        }
        onConfirmar={() => borrar.mutate()}
        eliminando={borrar.isPending}
      />
    </form>
  );
}
