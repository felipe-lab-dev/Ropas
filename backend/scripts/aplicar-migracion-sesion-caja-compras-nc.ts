/**
 * Vincula Compra y NotaCredito a SesionCaja: agrega columna `sesion_caja_id`
 * (UUID nullable) y la FK correspondiente en todos los schemas tenant_*.
 *
 * Idempotente: usa ADD COLUMN IF NOT EXISTS y verifica la FK antes de agregarla.
 * Backfill: filas existentes quedan con sesion_caja_id = NULL (correcto — las
 * operaciones previas al deploy no tenían turno de caja obligatorio).
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-sesion-caja-compras-nc.ts
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

    // 1. compras.sesion_caja_id
    await p.$executeRawUnsafe(`
      ALTER TABLE "compras"
        ADD COLUMN IF NOT EXISTS "sesion_caja_id" UUID
    `);
    const fkCompras: Array<{ count: number }> = await p.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.table_constraints
      WHERE table_schema = $1
        AND table_name = 'compras'
        AND constraint_name = 'compras_sesion_caja_id_fkey'
    `, schema_name);
    if ((fkCompras[0]?.count ?? 0) === 0) {
      await p.$executeRawUnsafe(`
        ALTER TABLE "compras"
          ADD CONSTRAINT "compras_sesion_caja_id_fkey"
          FOREIGN KEY ("sesion_caja_id")
          REFERENCES "sesiones_caja"("id")
          ON DELETE SET NULL ON UPDATE CASCADE
      `);
    }

    // 2. notas_credito.sesion_caja_id
    await p.$executeRawUnsafe(`
      ALTER TABLE "notas_credito"
        ADD COLUMN IF NOT EXISTS "sesion_caja_id" UUID
    `);
    const fkNc: Array<{ count: number }> = await p.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.table_constraints
      WHERE table_schema = $1
        AND table_name = 'notas_credito'
        AND constraint_name = 'notas_credito_sesion_caja_id_fkey'
    `, schema_name);
    if ((fkNc[0]?.count ?? 0) === 0) {
      await p.$executeRawUnsafe(`
        ALTER TABLE "notas_credito"
          ADD CONSTRAINT "notas_credito_sesion_caja_id_fkey"
          FOREIGN KEY ("sesion_caja_id")
          REFERENCES "sesiones_caja"("id")
          ON DELETE SET NULL ON UPDATE CASCADE
      `);
    }

    // 3. notas_credito.medio_devolucion (enum nullable)
    await p.$executeRawUnsafe(`
      ALTER TABLE "notas_credito"
        ADD COLUMN IF NOT EXISTS "medio_devolucion" medio_pago
    `);

    console.log(`  ✓ compras.sesion_caja_id, notas_credito.sesion_caja_id, notas_credito.medio_devolucion`);
  }

  await p.$disconnect();
  console.log('✅ Migración sesion-caja-compras-nc aplicada en todos los tenants.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
