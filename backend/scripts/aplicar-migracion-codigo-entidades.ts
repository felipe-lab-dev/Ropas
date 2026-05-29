/**
 * Aplica la migración 20260530_codigo_proveedor_cliente a todos los schemas tenant_*.
 *
 * Agrega y rellena el código legible autogenerado de:
 *   • proveedores → PR00001, PR00002, …
 *   • clientes    → CL00001, CL00002, …
 *
 * Idempotente, soft-delete safe y tolerante a tenants viejos sin esas tablas.
 *
 * Uso:
 *   pnpm --dir backend migrar:codigo-entidades
 *   pnpm --dir backend exec tsx scripts/aplicar-migracion-codigo-entidades.ts --tenant tenant_mi_tienda
 *
 * Cada tenant corre dentro de una transacción con `SET LOCAL search_path`, de modo que
 * el search_path no se pierde si el pool de Prisma reparte sentencias entre conexiones.
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

const SQL_PROVEEDORES = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'proveedores'
  ) THEN
    ALTER TABLE "proveedores" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(20);

    EXECUTE '
      WITH ordenados AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en ASC, id ASC) AS rn
        FROM proveedores
        WHERE codigo IS NULL
      )
      UPDATE proveedores p
      SET codigo = ''PR'' || LPAD(o.rn::text, 5, ''0'')
      FROM ordenados o
      WHERE p.id = o.id';

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname = 'proveedores_codigo_key'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX proveedores_codigo_key ON proveedores (codigo) WHERE codigo IS NOT NULL';
    END IF;
  END IF;
END $$;`;

const SQL_CLIENTES = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'clientes'
  ) THEN
    ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(20);

    EXECUTE '
      WITH ordenados AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en ASC, id ASC) AS rn
        FROM clientes
        WHERE codigo IS NULL
      )
      UPDATE clientes c
      SET codigo = ''CL'' || LPAD(o.rn::text, 5, ''0'')
      FROM ordenados o
      WHERE c.id = o.id';

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname = 'clientes_codigo_key'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX clientes_codigo_key ON clientes (codigo) WHERE codigo IS NOT NULL';
    END IF;
  END IF;
END $$;`;

/** Cuenta filas totales / con código de una tabla (fully-qualified, no depende de search_path). */
async function verificar(
  p: PrismaClient,
  schema: string,
  tabla: 'proveedores' | 'clientes',
): Promise<string> {
  try {
    const filas = await p.$queryRawUnsafe<Array<{ total: bigint; con_codigo: bigint }>>(
      `SELECT COUNT(*)::bigint AS total, COUNT(codigo)::bigint AS con_codigo FROM "${schema}"."${tabla}"`,
    );
    const total = Number(filas[0]?.total ?? 0);
    const con = Number(filas[0]?.con_codigo ?? 0);
    const ok = total === con ? '✓' : '⚠ FALTAN';
    return `${tabla}: ${con}/${total} ${ok}`;
  } catch {
    return `${tabla}: (no existe en este tenant)`;
  }
}

async function main() {
  const idxTenant = process.argv.indexOf('--tenant');
  const soloTenant = idxTenant >= 0 ? process.argv[idxTenant + 1] : null;

  const p = new PrismaClient();

  let schemas: Array<{ schema_name: string }> = await p.$queryRawUnsafe(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
    ORDER BY schema_name
  `);
  if (soloTenant) schemas = schemas.filter(s => s.schema_name === soloTenant);

  if (schemas.length === 0) {
    console.log(soloTenant ? `No se encontró el schema "${soloTenant}".` : 'No hay schemas tenant_* aún.');
    await p.$disconnect();
    return;
  }

  for (const { schema_name } of schemas) {
    console.log(`▶ Aplicando en "${schema_name}"…`);
    await p.$transaction(
      async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema_name}"`);
        await tx.$executeRawUnsafe(SQL_PROVEEDORES);
        await tx.$executeRawUnsafe(SQL_CLIENTES);
      },
      { timeout: 120_000 },
    );

    const vProv = await verificar(p, schema_name, 'proveedores');
    const vCli = await verificar(p, schema_name, 'clientes');
    console.log(`  ✓ ${schema_name}  ·  ${vProv}  ·  ${vCli}`);
  }

  await p.$disconnect();
  console.log(`✅ Migración aplicada a ${schemas.length} tenant(s).`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
