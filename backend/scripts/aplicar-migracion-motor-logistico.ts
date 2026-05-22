/**
 * Aplica la migración 20260521_motor_logistico (enum + columnas en productos)
 * a todos los schemas tenant_*.
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-motor-logistico.ts
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
  if (schemas.length === 0) { console.log('No hay tenants.'); await p.$disconnect(); return; }

  for (const { schema_name } of schemas) {
    console.log(`▶ ${schema_name}`);
    await p.$executeRawUnsafe(`SET search_path TO "${schema_name}"`);
    await p.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'clasificacion_abc' AND n.nspname = current_schema()
        ) THEN
          CREATE TYPE "clasificacion_abc" AS ENUM ('AA', 'A', 'B', 'C', 'D');
        END IF;
      END $$;
    `);
    await p.$executeRawUnsafe(`
      ALTER TABLE "productos"
        ADD COLUMN IF NOT EXISTS "clasificacion"       "clasificacion_abc",
        ADD COLUMN IF NOT EXISTS "clasificacion_score" DECIMAL(12, 4),
        ADD COLUMN IF NOT EXISTS "clasificado_en"      TIMESTAMP(3)
    `);
    await p.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS productos_clasificacion_idx ON "productos" ("clasificacion")
    `);
    console.log(`  ✓`);
  }
  await p.$disconnect();
  console.log('✅ Motor Logístico: schema aplicado.');
}

main().catch(e => { console.error(e); process.exit(1); });
