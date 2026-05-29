/**
 * Aplica la migración 20260527_cupones_temas a todos los schemas tenant_*.
 *
 *   Uso: pnpm migrar:cupones-temas
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

const SQL_PATH = join(__dirname, '..', 'prisma', 'migrations', '20260527_cupones_temas', 'migration.sql');

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
    const sentencias = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    for (const s of sentencias) {
      await p.$executeRawUnsafe(s);
    }
    console.log(`  ✓`);
  }

  await p.$disconnect();
  console.log('✅ Cupones (temas + fondos): migración aplicada.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
