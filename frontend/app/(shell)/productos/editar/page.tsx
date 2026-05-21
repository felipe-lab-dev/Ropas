'use client';

import { Suspense } from 'react';
import { EditarProductoCliente } from './editar-cliente';

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-[hsl(var(--text-muted))]">Cargando…</p>}>
      <EditarProductoCliente />
    </Suspense>
  );
}
