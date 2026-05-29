/**
 * IRREVERSIBLE — DROP SCHEMA tenant_mi_tienda CASCADE + DELETE FROM public.tenants.
 *
 * Felipe autorizó esta operación el 2026-05-28 vía AskUserQuestion eligiendo
 * la opción explícitamente marcada "irreversible / no hay vuelta atrás".
 * Los 3 cupones de valor ya fueron migrados a loremstore.
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

(async () => {
  const p = new PrismaClient();

  const previo: any[] = await p.$queryRawUnsafe(
    `SELECT
       (SELECT COUNT(*)::int FROM tenant_mi_tienda.cupones) AS cupones,
       (SELECT COUNT(*)::int FROM tenant_mi_tienda.ventas) AS ventas,
       (SELECT COUNT(*)::int FROM tenant_mi_tienda.clientes) AS clientes,
       (SELECT COUNT(*)::int FROM tenant_mi_tienda.productos) AS productos`,
  );
  console.log('A destruir:', previo[0]);

  await p.$transaction([
    p.$executeRawUnsafe(`DROP SCHEMA IF EXISTS tenant_mi_tienda CASCADE`),
    p.$executeRawUnsafe(`DELETE FROM public.tenants WHERE codigo = 'mi-tienda'`),
    p.$executeRawUnsafe(
      `INSERT INTO public.tenant_audit (tenant_id, evento, actor, detalles)
       VALUES (NULL, 'tenant_drop_cascade', 'felipe@importacionesherrera.com',
               '{"codigo":"mi-tienda","autorizado_vis":"AskUserQuestion 2026-05-28"}'::jsonb)`,
    ),
  ]);
  console.log('DROP SCHEMA tenant_mi_tienda CASCADE ejecutado.');
  console.log('DELETE FROM public.tenants WHERE codigo=mi-tienda ejecutado.');

  console.log('\n=== Estado post-drop ===');
  const schemas: any[] = await p.$queryRawUnsafe(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name`,
  );
  console.table(schemas);

  const tenants: any[] = await p.$queryRawUnsafe(
    `SELECT codigo, nombre, schema_name, estado FROM public.tenants ORDER BY creado_en`,
  );
  console.table(tenants);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
