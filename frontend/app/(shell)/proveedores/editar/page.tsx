'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Ruta legacy `/proveedores/editar?id=<id>`: redirige al listado con
 * `?editar=<id>` para abrir el modal. Conserva compat con bookmarks/E2E viejos.
 */
function RedirectEditar() {
  const router = useRouter();
  const search = useSearchParams();
  const id = search.get('id') ?? '';
  React.useEffect(() => {
    if (id) router.replace(`/proveedores?editar=${id}`);
    else router.replace('/proveedores');
  }, [id, router]);
  return (
    <div className="p-6 text-sm text-[hsl(var(--text-muted))]">Abriendo proveedor…</div>
  );
}

export default function Page() {
  return (
    <React.Suspense fallback={null}>
      <RedirectEditar />
    </React.Suspense>
  );
}
