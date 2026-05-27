/**
 * Verificación post-migración 20260526_facturacion_sunat.
 * Lista qué tablas nuevas existen en cada tenant + diagnostica tenants
 * en versiones viejas del schema.
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

const TABLAS_NUEVAS = ['series_cpe', 'documentos_electronicos', 'configuracion_facturacion'];
const COLS_NUEVAS = [
  { tabla: 'clientes', col: 'ubigeo_codigo' },
  { tabla: 'sucursales', col: 'codigo_anexo_sunat' },
  { tabla: 'productos', col: 'tipo_afectacion_igv' },
  { tabla: 'ventas', col: 'tipo_cpe' },
  { tabla: 'notas_credito', col: 'codigo_tipo_nc' },
];

async function main() {
  const p = new PrismaClient();

  const schemas: Array<{ schema_name: string }> = await p.$queryRawUnsafe(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'
    ORDER BY schema_name
  `);

  for (const { schema_name } of schemas) {
    console.log(`\n=== ${schema_name} ===`);

    const tablas: Array<{ table_name: string }> = await p.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema_name}' ORDER BY table_name`
    );
    const setTablas = new Set(tablas.map(t => t.table_name));

    console.log(`Tablas totales: ${setTablas.size}`);
    console.log(`¿Tiene 'proveedores'? ${setTablas.has('proveedores') ? '✓' : '✗ NO'}`);

    const tablasNuevasOk = TABLAS_NUEVAS.filter(t => setTablas.has(t));
    const tablasNuevasFalt = TABLAS_NUEVAS.filter(t => !setTablas.has(t));
    console.log(`Tablas nuevas creadas: ${tablasNuevasOk.length}/${TABLAS_NUEVAS.length}`);
    if (tablasNuevasFalt.length > 0) {
      console.log(`  ✗ Faltan: ${tablasNuevasFalt.join(', ')}`);
    }

    for (const { tabla, col } of COLS_NUEVAS) {
      if (!setTablas.has(tabla)) {
        console.log(`  ⊘ ${tabla}.${col} — tabla no existe en este tenant`);
        continue;
      }
      const cols: Array<{ column_name: string }> = await p.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema_name}' AND table_name = '${tabla}' AND column_name = '${col}'`
      );
      console.log(`  ${cols.length > 0 ? '✓' : '✗'} ${tabla}.${col}`);
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
