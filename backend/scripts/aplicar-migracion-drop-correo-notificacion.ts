/**
 * Aplica la migración 20260527_drop_correo_notificacion (DROP COLUMN correo_notificacion
 * de configuracion_facturacion) a todos los schemas tenant_* (o solo al tenant
 * indicado con --tenant <name>).
 *
 *   Uso: pnpm exec tsx scripts/aplicar-migracion-drop-correo-notificacion.ts
 *        pnpm exec tsx scripts/aplicar-migracion-drop-correo-notificacion.ts --tenant tenant_mi_tienda
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
  '20260527_drop_correo_notificacion',
  'migration.sql',
);

async function main() {
  const tenantFiltro = process.argv.includes('--tenant')
    ? process.argv[process.argv.indexOf('--tenant') + 1]
    : null;

  if (tenantFiltro) {
    console.log(`Filtrando a tenant: ${tenantFiltro}`);
  }

  const p = new PrismaClient();
  const sql = readFileSync(SQL_PATH, 'utf-8');

  const schemas: Array<{ schema_name: string }> = await p.$queryRawUnsafe(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'
  `);

  const schemasFiltrados = tenantFiltro
    ? schemas.filter(s => s.schema_name === tenantFiltro)
    : schemas;

  if (schemasFiltrados.length === 0) {
    console.log(tenantFiltro
      ? `No se encontró el tenant '${tenantFiltro}'. Verifica el nombre.`
      : 'No hay tenants.');
    await p.$disconnect();
    return;
  }

  let exitosos = 0;
  let fallidos = 0;

  for (const { schema_name } of schemasFiltrados) {
    console.log(`▶ ${schema_name}`);
    try {
      await p.$executeRawUnsafe(`SET search_path TO "${schema_name}"`);
      const sentencias = partirSql(sql);
      for (const s of sentencias) {
        if (s.trim()) await p.$executeRawUnsafe(s);
      }
      console.log(`  ✓ DROP COLUMN aplicado`);
      exitosos++;
    } catch (err) {
      console.error(`  ✗ ERROR en ${schema_name}:`, err);
      fallidos++;
    }
  }

  await p.$disconnect();

  console.log('');
  console.log(`✅ drop_correo_notificacion: migración completada.`);
  console.log(`   Exitosos: ${exitosos} / ${schemasFiltrados.length}`);
  if (fallidos > 0) {
    console.log(`   ⚠  Fallidos: ${fallidos} — revisar errores arriba.`);
    process.exit(1);
  }
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

main().catch(e => {
  console.error(e);
  process.exit(1);
});
