/**
 * Diagnóstico de qué hay en tenant_loremstore: productos, variantes, stock,
 * ventas, movimientos de kardex. Solo lectura.
 *
 *   Uso: pnpm exec tsx scripts/diagnostico-datos-loremstore.ts
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

const SCHEMA = 'tenant_loremstore';
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('schema', SCHEMA);

(async () => {
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  console.log(`\n📊 Inventario de datos en ${SCHEMA}\n${'='.repeat(60)}`);

  const counts = await Promise.all([
    p.sucursal.count(),
    p.categoria.count(),
    p.marca.count(),
    p.producto.count({ where: { eliminadoEn: null } }),
    p.variante.count({ where: { eliminadoEn: null } }),
    p.stockSucursal.count(),
    p.cliente.count({ where: { eliminadoEn: null } }),
    p.proveedor.count({ where: { eliminadoEn: null } }),
    p.venta.count({ where: { eliminadoEn: null } }),
    p.ventaItem.count(),
    p.movimientoStock.count(),
    p.compra.count(),
    p.auditLog.count({ where: { modulo: 'productos', accion: 'importacion-csv' } }),
  ]);

  const labels = [
    'Sucursales',
    'Categorías',
    'Marcas',
    'Productos (no eliminados)',
    'Variantes',
    'Stocks por sucursal',
    'Clientes',
    'Proveedores',
    'Ventas (no eliminadas)',
    'Items de venta',
    'Movimientos de stock (kardex)',
    'Compras',
    'Importaciones CSV registradas',
  ];

  for (let i = 0; i < counts.length; i++) {
    const txt = `${labels[i]}:`.padEnd(34);
    const num = String(counts[i]).padStart(8);
    console.log(`  ${txt}${num}`);
  }

  // Stock total
  const stockTotal = await p.stockSucursal.aggregate({
    _sum: { disponible: true, reservado: true },
  });
  console.log(`\n  Stock disponible total:`.padEnd(36) +
    String(Number(stockTotal._sum.disponible ?? 0)).padStart(8));
  console.log(`  Stock reservado total:`.padEnd(36) +
    String(Number(stockTotal._sum.reservado ?? 0)).padStart(8));

  // Productos con kardex
  const productosConMovimientos = await p.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(DISTINCT v.producto_id) AS count
     FROM ${SCHEMA}.movimientos_stock m
     JOIN ${SCHEMA}.variantes v ON v.id = m.variante_id`,
  );
  console.log(`\n  Productos CON movimientos de kardex:`.padEnd(38) +
    String(productosConMovimientos[0]?.count ?? 0).padStart(6));

  // Ejemplos de productos
  const algunos = await p.producto.findMany({
    where: { eliminadoEn: null },
    take: 5,
    select: { sku: true, nombre: true, _count: { select: { variantes: true } } },
  });
  if (algunos.length > 0) {
    console.log('\n  Primeros 5 productos:');
    for (const a of algunos) {
      console.log(`    · ${a.sku} — ${a.nombre} (${a._count.variantes} variantes)`);
    }
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
