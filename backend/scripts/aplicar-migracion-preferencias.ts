/**
 * Aplica la migración 20260521_usuario_preferencias_ui a todos los schemas tenant_*.
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-preferencias.ts
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

async function main() {
  const p = new PrismaClient();
  const schemas: Array<{ schema_name: string }> = await p.$queryRawUnsafe(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'
  `);
  if (schemas.length === 0) {
    console.log('No hay schemas tenant_*.');
    await p.$disconnect();
    return;
  }
  for (const { schema_name } of schemas) {
    console.log(`▶ ${schema_name}`);
    await p.$executeRawUnsafe(`SET search_path TO "${schema_name}"`);
    await p.$executeRawUnsafe(`
      ALTER TABLE "usuarios"
        ADD COLUMN IF NOT EXISTS "preferencias_ui" JSONB NOT NULL DEFAULT '{}'
    `);
    console.log(`  ✓`);
  }
  await p.$disconnect();
  console.log('✅ Migración aplicada.');
}

main().catch(e => { console.error(e); process.exit(1); });
