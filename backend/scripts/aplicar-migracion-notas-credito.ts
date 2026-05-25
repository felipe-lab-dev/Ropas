/**
 * Aplica la migración 20260525_notas_credito_y_soft_delete_venta
 * a todos los schemas tenant_*.
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-notas-credito.ts
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
  '20260525_notas_credito_y_soft_delete_venta',
  'migration.sql',
);

function partirSql(sql: string): string[] {
  // Divide por `;` final de sentencia ignorando los que están dentro de bloques DO $$ ... $$.
  const out: string[] = [];
  let buffer = '';
  let inDollar = false;
  for (const linea of sql.split(/\r?\n/)) {
    buffer += linea + '\n';
    if (/\$\$/.test(linea)) inDollar = !inDollar;
    if (!inDollar && linea.trim().endsWith(';')) {
      out.push(buffer.trim().replace(/;$/, ''));
      buffer = '';
    }
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

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

  for (const { schema_name } of schemas) {
    console.log(`▶ ${schema_name}`);
    await p.$executeRawUnsafe(`SET search_path TO "${schema_name}"`);
    const sentencias = partirSql(sql);
    for (const s of sentencias) {
      if (s.trim()) await p.$executeRawUnsafe(s);
    }
    console.log(`  ✓ DDL aplicado (eliminado_en en ventas + notas_credito + notas_credito_items)`);
  }

  await p.$disconnect();
  console.log('\n✅ Migración aplicada a todos los tenants.');
}

main().catch(err => {
  console.error('💥', err);
  process.exit(1);
});
