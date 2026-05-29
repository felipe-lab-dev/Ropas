/**
 * Aplica la migración 20260529_venta_item_costo_unitario a todos los schemas tenant_*.
 * Agrega la columna costo_unitario a venta_items y rellena (backfill) el costo
 * histórico desde productos.precio_compra.
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-venta-item-costo.ts
 *   (o)  pnpm migrar:venta-item-costo
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

const SQL_PATH = join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260529_venta_item_costo_unitario',
  'migration.sql',
);

async function main() {
  const p = new PrismaClient();
  const sql = readFileSync(SQL_PATH, 'utf-8');

  const schemas: Array<{ schema_name: string }> = await p.$queryRawUnsafe(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'
  `);
  if (schemas.length === 0) {
    console.log('No hay tenants.');
    await p.$disconnect();
    return;
  }

  const sentencias = partirSql(sql);
  for (const { schema_name } of schemas) {
    console.log(`▶ ${schema_name}`);
    await p.$transaction(
      async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema_name}"`);
        for (const s of sentencias) {
          if (s.trim()) await tx.$executeRawUnsafe(s);
        }
      },
      { timeout: 120_000 },
    );
    console.log(`  ✓ costo_unitario agregado + backfill aplicado`);
  }

  await p.$disconnect();
  console.log('✅ venta_items.costo_unitario: migración aplicada a todos los tenants.');
}

/**
 * Parte un script SQL en sentencias completas respetando bloques DO $$...$$.
 */
function partirSql(sql: string): string[] {
  const sentencias: string[] = [];
  let buffer = '';
  let dentroDoBlock = false;
  for (const linea of sql.split(/\r?\n/)) {
    if (/^DO\s+\$\$/i.test(linea.trim())) dentroDoBlock = true;
    buffer += linea + '\n';
    if (dentroDoBlock) {
      if (/END\s+\$\$;\s*$/i.test(linea.trim())) {
        sentencias.push(buffer.trim());
        buffer = '';
        dentroDoBlock = false;
      }
    } else if (linea.trim().endsWith(';')) {
      sentencias.push(buffer.trim());
      buffer = '';
    }
  }
  if (buffer.trim()) sentencias.push(buffer.trim());
  return sentencias;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
