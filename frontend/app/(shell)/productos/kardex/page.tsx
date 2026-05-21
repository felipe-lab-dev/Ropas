'use client';

import { Suspense } from 'react';
import { KardexCliente } from './kardex-cliente';

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-[hsl(var(--text-muted))]">Cargando…</p>}>
      <KardexCliente />
    </Suspense>
  );
}
