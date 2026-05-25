/**
 * Aplica la migración 20260524_cupones (módulo de cupones y promociones)
 * a todos los schemas tenant_*.
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-cupones.ts
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

const SQL_PATH = join(__dirname, '..', 'prisma', 'migrations', '20260524_cupones', 'migration.sql');

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
    console.log(`  ✓ DDL aplicado`);
  }

  // Habilitar el módulo "cupones" en todos los tenants que aún no lo tengan.
  await p.$executeRawUnsafe(`SET search_path TO "public"`);
  const tenantsActualizados: Array<{ codigo: string }> = await p.$queryRawUnsafe(`
    UPDATE "tenants"
    SET modulos_habilitados = (
      SELECT jsonb_agg(DISTINCT m)
      FROM jsonb_array_elements_text(modulos_habilitados || '["cupones"]'::jsonb) m
    )
    WHERE NOT (modulos_habilitados @> '["cupones"]'::jsonb)
    RETURNING codigo;
  `);
  console.log(`▶ Módulo "cupones" habilitado en ${tenantsActualizados.length} tenant(s)`);
  for (const t of tenantsActualizados) console.log(`  ✓ ${t.codigo}`);

  await p.$disconnect();
  console.log('✅ Cupones: migración aplicada y módulo habilitado.');
}

/**
 * Parte un script SQL en sentencias completas respetando bloques DO $$...$$.
 */
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

main().catch(e => {
  console.error(e);
  process.exit(1);
});
