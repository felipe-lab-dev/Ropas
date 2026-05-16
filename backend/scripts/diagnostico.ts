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

  console.log('--- Datos crudos en tenant_mi_tienda ---');
  for (const t of ['sucursales', 'categorias', 'usuarios', 'roles']) {
    const r: any[] = await p.$queryRawUnsafe(`SELECT * FROM tenant_mi_tienda.${t}`);
    console.log(`${t}: ${r.length} filas`);
    if (r.length > 0) console.log('  primera:', JSON.stringify(r[0], null, 2));
  }

  console.log('\n--- Mismas vía PrismaClient con URL ?schema=tenant_mi_tienda ---');
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', 'tenant_mi_tienda');
  const pt = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  console.log('  sucursales (Prisma):', (await pt.sucursal.findMany()).length, 'filas');
  console.log('  categorias (Prisma):', (await pt.categoria.findMany()).length, 'filas');
  console.log('  roles (Prisma):     ', (await pt.rol.findMany()).length, 'filas');

  console.log('\n--- Usando $queryRawUnsafe en cliente con ?schema=... (debería resolver via search_path) ---');
  const r: any[] = await pt.$queryRawUnsafe(`SHOW search_path`);
  console.log('search_path:', r);

  await p.$disconnect();
  await pt.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
