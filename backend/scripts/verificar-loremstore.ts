/**
 * Foto completa de tenant_loremstore: lo que se ve tanto en localhost:3000
 * como en loremstore.tienda.enkihubs.com (es la misma DB de Azure).
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

(async () => {
  const p = new PrismaClient();

  console.log('=== Schemas tenant_* en pg-ropas ===');
  console.table(await p.$queryRawUnsafe(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name`,
  ));

  console.log('\n=== public.tenants ===');
  console.table(await p.$queryRawUnsafe(
    `SELECT codigo, nombre, schema_name, estado, eliminado_en
     FROM public.tenants ORDER BY creado_en`,
  ));

  console.log('\n=== tenant_loremstore — conteo por tabla ===');
  const tablas = [
    'cupones', 'cupones_usos', 'ventas', 'venta_items', 'venta_pagos',
    'clientes', 'productos', 'variantes', 'stock_sucursales',
    'usuarios', 'roles', 'sucursales', 'categorias', 'marcas',
    'proveedores', 'compras', 'notas_credito', 'sesiones_caja', 'movimientos_caja',
  ];
  const conteos: any[] = [];
  for (const t of tablas) {
    try {
      const r: any[] = await p.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE ${await tieneColumna(p, 'tenant_loremstore', t, 'eliminado_en') ? 'eliminado_en IS NULL' : 'true'})::int AS activos
         FROM "tenant_loremstore"."${t}"`,
      );
      if (r[0].total > 0) conteos.push({ tabla: t, total: r[0].total, activos: r[0].activos });
    } catch { /* tabla no existe */ }
  }
  console.table(conteos);

  console.log('\n=== Cupones activos en loremstore (lo que vas a ver) ===');
  console.table(await p.$queryRawUnsafe(
    `SELECT codigo, nombre, estado, tipo_descuento, valor_descuento,
            fecha_inicio::date AS inicio, fecha_fin::date AS fin
     FROM tenant_loremstore.cupones
     WHERE eliminado_en IS NULL
     ORDER BY creado_en DESC`,
  ));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

async function tieneColumna(p: PrismaClient, schema: string, tabla: string, columna: string): Promise<boolean> {
  const r: any[] = await p.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
    schema, tabla, columna,
  );
  return r.length > 0;
}
