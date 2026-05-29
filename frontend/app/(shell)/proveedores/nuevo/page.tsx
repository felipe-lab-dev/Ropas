'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { postear, mensajeError } from '@/lib/api/client';
import { ProveedorFormulario } from '../proveedor-formulario';
import { aPayloadApi, type ProveedorFormValues } from '../proveedor-schema';

interface NuevoProveedorContenidoProps {
  modoModal?: boolean;
  onCerrar?: () => void;
}

/**
 * Contenido reusable de "Nuevo proveedor".
 *  - En `modoModal`: omite el PageHeader, usa `enModal` en el formulario y
 *    notifica al padre con `onCerrar` después de crear.
 *  - En página standalone: renderiza el header + Card y redirige a /proveedores
 *    tras crear (compat con bookmarks viejos).
 */
export function NuevoProveedorContenido({ modoModal = false, onCerrar }: NuevoProveedorContenidoProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const mutar = useMutation({
    mutationFn: (valores: ProveedorFormValues) =>
      postear<{ id: string; razonSocial: string }>('/proveedores', aPayloadApi(valores)),
    onSuccess: data => {
      toast.success(`Proveedor "${data?.razonSocial ?? ''}" registrado`);
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      if (modoModal && onCerrar) onCerrar();
      else router.push('/proveedores');
    },
    onError: e => setError(mensajeError(e)),
  });

  const onCancelar = React.useCallback(() => {
    if (modoModal && onCerrar) onCerrar();
    else router.push('/proveedores');
  }, [modoModal, onCerrar, router]);

  if (modoModal) {
    return (
      <ProveedorFormulario
        guardando={mutar.isPending}
        ctaLabel="Guardar proveedor"
        errorServidor={error}
        enModal
        onGuardar={v => { setError(null); mutar.mutate(v); }}
        onCancelar={onCancelar}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Nuevo proveedor"
        descripcion="Registra los datos fiscales y de contacto. Se valida el formato del RUC/DNI/email antes de guardar."
        acciones={
          <Button variant="ghost" asChild>
            <Link href="/proveedores"><ArrowLeft className="size-4" /> Volver</Link>
          </Button>
        }
      />

      <ProveedorFormulario
        guardando={mutar.isPending}
        ctaLabel="Guardar proveedor"
        errorServidor={error}
        onGuardar={v => { setError(null); mutar.mutate(v); }}
        onCancelar={onCancelar}
      />
    </div>
  );
}

/**
 * Ruta legacy `/proveedores/nuevo`: redirige al listado con `?nuevo=1` para
 * abrir el modal de alta. Conserva compatibilidad con bookmarks viejos.
 */
export default function NuevoProveedorRedirectPage() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace('/proveedores?nuevo=1');
  }, [router]);
  return (
    <div className="p-6 text-sm text-[hsl(var(--text-muted))]">Abriendo formulario…</div>
  );
}
