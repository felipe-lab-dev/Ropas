/**
 * Copia 3 cupones aleatorios de tenant_mi_tienda → tenant_loremstore.
 * Limpia dependencias cross-tenant:
 *   - creado_por_id = NULL (el usuario vive en mi_tienda, no existe en loremstore)
 *   - clientes_elegibles_ids / categorias_aplicables_ids / productos_aplicables_ids = []
 *     (apuntan a UUIDs del schema mi_tienda; en loremstore esos IDs no existen)
 *
 * Genera nuevos UUIDs para evitar colisiones futuras si rehacés el seed.
 * Idempotente por código: si el código ya existe en loremstore, lo salta.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
}

(async () => {
  const p = new PrismaClient();

  const origen = await p.$queryRawUnsafe<any[]>(
    `SELECT * FROM tenant_mi_tienda.cupones
     WHERE eliminado_en IS NULL
     ORDER BY random()
     LIMIT 3`,
  );

  if (origen.length === 0) {
    console.log('No hay cupones para migrar.');
    process.exit(0);
  }

  console.log(`\nCupones seleccionados para migrar (random):`);
  console.table(origen.map(c => ({
    codigo: c.codigo, nombre: c.nombre, valor: c.valor_descuento, estado: c.estado,
  })));

  let migrados = 0;
  for (const c of origen) {
    const existe = await p.$queryRawUnsafe<any[]>(
      `SELECT 1 FROM tenant_loremstore.cupones WHERE codigo = $1 LIMIT 1`,
      c.codigo,
    );
    if (existe.length > 0) {
      console.log(`  - ${c.codigo}: ya existe en loremstore, salto`);
      continue;
    }

    await p.$executeRawUnsafe(
      `INSERT INTO tenant_loremstore.cupones (
        id, codigo, nombre, descripcion,
        tipo_descuento, valor_descuento,
        monto_minimo_compra, descuento_maximo,
        fecha_inicio, fecha_fin,
        usos_maximos_total, usos_maximos_por_cliente,
        segmento, clientes_elegibles_ids,
        aplicable_a, categorias_aplicables_ids, productos_aplicables_ids,
        campania, plantilla,
        estado, pausado_en,
        diseno_color_primario, diseno_color_secundario, diseno_mensaje, diseno_emoji,
        creado_por_id, creado_en, actualizado_en, eliminado_en
      ) VALUES (
        $1::uuid, $2, $3, $4,
        $5::tenant_loremstore.tipo_descuento_cupon, $6,
        $7, $8,
        $9::timestamptz, $10::timestamptz,
        $11, $12,
        $13::tenant_loremstore.segmento_cupon, ARRAY[]::uuid[],
        $14::tenant_loremstore.aplicable_a_cupon, ARRAY[]::uuid[], ARRAY[]::uuid[],
        $15, $16,
        $17::tenant_loremstore.estado_cupon, $18::timestamptz,
        $19, $20, $21, $22,
        NULL, NOW(), NOW(), NULL
      )`,
      randomUUID(),
      c.codigo,
      c.nombre,
      c.descripcion,
      c.tipo_descuento,
      c.valor_descuento,
      c.monto_minimo_compra,
      c.descuento_maximo,
      c.fecha_inicio,
      c.fecha_fin,
      c.usos_maximos_total,
      c.usos_maximos_por_cliente,
      c.segmento,
      c.aplicable_a,
      c.campania,
      c.plantilla,
      c.estado,
      c.pausado_en,
      c.diseno_color_primario,
      c.diseno_color_secundario,
      c.diseno_mensaje,
      c.diseno_emoji,
    );
    migrados++;
    console.log(`  + ${c.codigo}: migrado`);
  }

  const total: any[] = await p.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM tenant_loremstore.cupones WHERE eliminado_en IS NULL`,
  );
  console.log(`\nMigrados ${migrados}. Total cupones activos en loremstore: ${total[0].n}`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
