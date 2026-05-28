/**
 * Aplica la migración 20260528_serie_cpe_una_por_tipo a todos los schemas tenant_*.
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-serie-cpe-una-por-tipo.ts
 *        pnpm exec tsx scripts/aplicar-migracion-serie-cpe-una-por-tipo.ts --tenant tenant_mi_tienda
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
  '20260528_serie_cpe_una_por_tipo',
  'migration.sql',
);

async function main() {
  const tenantFiltro = process.argv.includes('--tenant')
    ? process.argv[process.argv.indexOf('--tenant') + 1]
    : null;
  if (tenantFiltro) console.log(`Filtrando a tenant: ${tenantFiltro}`);

  const p = new PrismaClient();
  const sql = readFileSync(SQL_PATH, 'utf-8');
  const schemas: Array<{ schema_name: string }> = await p.$queryRawUnsafe(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'
  `);
  const filtrados = tenantFiltro
    ? schemas.filter(s => s.schema_name === tenantFiltro)
    : schemas;

  let ok = 0, fail = 0;
  for (const { schema_name } of filtrados) {
    console.log(`▶ ${schema_name}`);
    try {
      await p.$executeRawUnsafe(`SET search_path TO "${schema_name}"`);
      const sentencias = partirSql(sql);
      for (const s of sentencias) {
        if (s.trim()) await p.$executeRawUnsafe(s);
      }
      console.log(`  ✓ Migración aplicada`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ERROR en ${schema_name}:`, err);
      fail++;
    }
  }
  await p.$disconnect();
  console.log(`\n✅ Completada: ${ok}/${filtrados.length}`);
  if (fail > 0) process.exit(1);
}

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

main().catch(e => { console.error(e); process.exit(1); });
