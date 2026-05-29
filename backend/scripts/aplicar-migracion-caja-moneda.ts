/**
 * Caja multi-moneda: agrega `moneda` a movimientos_caja (default PEN) y
 * `saldos_moneda` (JSONB) a sesiones_caja, en todos los schemas tenant_*.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Backfill: los movimientos existentes
 * quedan en 'PEN' por el DEFAULT; las sesiones existentes con saldos_moneda NULL
 * (= solo PEN, sin cambio de comportamiento).
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-caja-moneda.ts
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
    console.log('No hay tenants.');
    await p.$disconnect();
    return;
  }

  for (const { schema_name } of schemas) {
    console.log(`▶ ${schema_name}`);
    await p.$executeRawUnsafe(`SET search_path TO "${schema_name}"`);
    await p.$executeRawUnsafe(`
      ALTER TABLE "movimientos_caja"
        ADD COLUMN IF NOT EXISTS "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN'
    `);
    await p.$executeRawUnsafe(`
      ALTER TABLE "sesiones_caja"
        ADD COLUMN IF NOT EXISTS "saldos_moneda" JSONB
    `);
    console.log(`  ✓`);
  }
  await p.$disconnect();
  console.log('✅ Caja multi-moneda: schema aplicado.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
