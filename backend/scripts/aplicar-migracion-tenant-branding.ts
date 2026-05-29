/**
 * Aplica la migración 20260529_tenant_branding: agrega la columna `branding` (JSONB)
 * a public.tenants. Es una migración GLOBAL (schema public), NO per-tenant.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Seguro de reaplicar. No destructivo.
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-tenant-branding.ts
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
  '20260529_tenant_branding',
  'migration.sql',
);

async function main() {
  const p = new PrismaClient();
  const sql = readFileSync(SQL_PATH, 'utf-8');

  console.log('▶ public.tenants — ADD COLUMN branding JSONB');
  await p.$executeRawUnsafe(`SET search_path TO public`);
  await p.$executeRawUnsafe(sql);
  console.log('  ✓ columna branding lista');

  await p.$disconnect();
  console.log('✅ tenant_branding: migración aplicada a public.tenants.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
