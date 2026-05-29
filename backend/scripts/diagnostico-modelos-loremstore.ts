/**
 * Diagnostico real de drift: por cada modelo del PrismaClient del tenant,
 * hace findFirst() y reporta cualquier P2022 (columna faltante) o P2021 (tabla faltante).
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
}

// Lista de modelos a probar (los que viven en schemas de tenant)
const MODELOS_TENANT = [
  'usuario', 'rol', 'sucursal', 'categoria', 'marca',
  'producto', 'variante', 'stockSucursal', 'movimientoStock',
  'cliente', 'venta', 'ventaItem', 'ventaPago',
  'notaCredito', 'notaCreditoItem',
  'sesionCaja', 'movimientoCaja',
  'cupon', 'cuponUso',
  'proveedor', 'compra', 'compraItem', 'pagoCompra',
  'planCuenta', 'periodoContable', 'asientoContable', 'asientoDetalle',
  'serieCpe', 'documentoElectronico', 'configuracionFacturacion',
  'auditLog',
];

(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', 'tenant_loremstore');
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } }) as any;

  const resultados: any[] = [];
  for (const modelo of MODELOS_TENANT) {
    if (!p[modelo]) {
      resultados.push({ modelo, status: '?', detalle: 'no existe en Prisma Client' });
      continue;
    }
    try {
      await p[modelo].findFirst();
      resultados.push({ modelo, status: 'OK', detalle: '' });
    } catch (e: any) {
      const codigo = e?.code ?? '?';
      const meta = e?.meta ?? {};
      const detalle = codigo === 'P2022'
        ? `COL FALTANTE: ${meta.column}`
        : codigo === 'P2021'
        ? `TABLA FALTANTE`
        : (e?.message || String(e)).split('\n')[0].slice(0, 100);
      resultados.push({ modelo, status: `❌ ${codigo}`, detalle });
    }
  }
  console.table(resultados);

  const fallos = resultados.filter(r => r.status.startsWith('❌'));
  console.log(`\n${MODELOS_TENANT.length - fallos.length}/${MODELOS_TENANT.length} modelos OK. ${fallos.length} con drift.`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
