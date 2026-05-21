/**
 * Aplica la migración 20260521_producto_codigo a todos los schemas tenant_*.
 *
 * Uso: pnpm exec tsx scripts/aplicar-migracion-codigo.ts
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
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
  `);

  if (schemas.length === 0) {
    console.log('No hay schemas tenant_* aún.');
    await p.$disconnect();
    return;
  }

  for (const { schema_name } of schemas) {
    console.log(`▶ Aplicando migración en "${schema_name}"…`);
    await p.$executeRawUnsafe(`SET search_path TO "${schema_name}"`);
    await p.$executeRawUnsafe(`ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(40)`);
    await p.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = current_schema() AND indexname = 'productos_codigo_key'
        ) THEN
          EXECUTE 'CREATE UNIQUE INDEX productos_codigo_key ON productos (codigo) WHERE codigo IS NOT NULL';
        END IF;
      END $$;
    `);
    console.log(`  ✓ ${schema_name}`);
  }

  await p.$disconnect();
  console.log('✅ Migración aplicada a todos los tenants.');
}

main().catch(e => { console.error(e); process.exit(1); });
