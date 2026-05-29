'use client';

import { Suspense } from 'react';
import { NuevoProductoCliente } from './nuevo-producto-cliente';

export default function NuevoProductoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[hsl(var(--text-muted))]">Cargando…</p>}>
      <NuevoProductoCliente />
    </Suspense>
  );
}
