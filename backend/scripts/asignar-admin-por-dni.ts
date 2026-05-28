/**
 * Asegura que un usuario tenga el rol "Administrador" (permisos = ['*']) en su tenant.
 * Idempotente: si ya lo tiene, no toca nada.
 *
 * Uso:  pnpm tsx scripts/asignar-admin-por-dni.ts <DNI> [tenant-code]
 *   - DNI:           requerido.
 *   - tenant-code:   opcional. Si se omite, busca el usuario en TODOS los tenants
 *                    listados en public.tenants y reporta dónde está.
 *
 * Ejemplo:
 *   pnpm tsx scripts/asignar-admin-por-dni.ts 75136140
 *   pnpm tsx scripts/asignar-admin-por-dni.ts 75136140 loremstore
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

(function cargarEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
})();

interface UsuarioEncontrado {
  tenantCode: string;
  schemaName: string;
  usuarioId: string;
  nombre: string;
  email: string;
  rolNombre: string;
  rolPermisos: string[];
}

function clienteDeTenant(schemaName: string): PrismaClient {
  const dbUrl = process.env.DATABASE_URL!;
  const url = dbUrl.includes('schema=')
    ? dbUrl.replace(/schema=[^&]+/, `schema=${schemaName}`)
    : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}schema=${schemaName}`;
  return new PrismaClient({ datasourceUrl: url });
}

async function buscarEnTodosLosTenants(dni: string): Promise<UsuarioEncontrado[]> {
  const prismaPublic = new PrismaClient();
  const tenants = await prismaPublic.tenant.findMany({
    where: { eliminadoEn: null },
    select: { codigo: true, schemaName: true },
  });
  await prismaPublic.$disconnect();

  const resultados: UsuarioEncontrado[] = [];
  for (const t of tenants) {
    const cli = clienteDeTenant(t.schemaName);
    try {
      const usuario = await cli.usuario.findFirst({
        where: { dni, eliminadoEn: null },
        include: { rol: { select: { nombre: true, permisos: true } } },
      });
      if (usuario) {
        resultados.push({
          tenantCode: t.codigo,
          schemaName: t.schemaName,
          usuarioId: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rolNombre: usuario.rol.nombre,
          rolPermisos: usuario.rol.permisos,
        });
      }
    } catch (err) {
      // Schema puede no tener tablas (tenant huérfano) — ignoramos
      const msg = err instanceof Error ? err.message : String(err);
      if (!/relation .* does not exist/i.test(msg)) {
        console.warn(`  ⚠ Error consultando ${t.schemaName}: ${msg}`);
      }
    } finally {
      await cli.$disconnect();
    }
  }
  return resultados;
}

async function asegurarAdmin(schemaName: string, usuarioId: string): Promise<{ cambio: boolean; rolNombreFinal: string; rolPermisosFinales: string[] }> {
  const cli = clienteDeTenant(schemaName);
  try {
    const rolAdmin = await cli.rol.findFirst({ where: { nombre: 'Administrador' } });
    if (!rolAdmin) {
      throw new Error(`No existe rol "Administrador" en ${schemaName}`);
    }
    const usuario = await cli.usuario.findUnique({
      where: { id: usuarioId },
      include: { rol: { select: { id: true, nombre: true, permisos: true } } },
    });
    if (!usuario) throw new Error(`Usuario ${usuarioId} desapareció`);

    if (usuario.rolId === rolAdmin.id) {
      return { cambio: false, rolNombreFinal: usuario.rol.nombre, rolPermisosFinales: usuario.rol.permisos };
    }

    await cli.usuario.update({
      where: { id: usuario.id },
      data: { rolId: rolAdmin.id, activo: true },
    });
    return { cambio: true, rolNombreFinal: rolAdmin.nombre, rolPermisosFinales: rolAdmin.permisos };
  } finally {
    await cli.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dni = args[0];
  const tenantCodeOpcional = args[1];
  if (!dni || dni === '--help') {
    console.error('Uso: pnpm tsx scripts/asignar-admin-por-dni.ts <DNI> [tenant-code]');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurado en .env');
  }

  console.log(`\n▶ Buscando usuario con DNI ${dni}...\n`);

  const encontrados = await buscarEnTodosLosTenants(dni);

  if (encontrados.length === 0) {
    console.error(`❌ No se encontró ningún usuario con DNI ${dni} en ningún tenant.\n`);
    process.exit(1);
  }

  const candidatos = tenantCodeOpcional
    ? encontrados.filter(e => e.tenantCode === tenantCodeOpcional)
    : encontrados;

  if (candidatos.length === 0) {
    console.error(`❌ No se encontró el usuario con DNI ${dni} en el tenant "${tenantCodeOpcional}".`);
    console.error(`   Lo tengo en: ${encontrados.map(e => e.tenantCode).join(', ')}\n`);
    process.exit(1);
  }

  if (candidatos.length > 1) {
    console.log(`⚠ El usuario aparece en ${candidatos.length} tenants. Procesando todos:\n`);
  }

  for (const u of candidatos) {
    console.log(`📍 Tenant: ${u.tenantCode} (${u.schemaName})`);
    console.log(`   Nombre:        ${u.nombre}`);
    console.log(`   Email:         ${u.email}`);
    console.log(`   Rol actual:    ${u.rolNombre}`);
    console.log(`   Permisos:      ${u.rolPermisos.includes('*') ? "['*'] (comodín — acceso total)" : `[${u.rolPermisos.length} permisos]`}`);

    const resultado = await asegurarAdmin(u.schemaName, u.usuarioId);
    if (!resultado.cambio) {
      console.log(`   ✅ Ya tiene rol Administrador con ${resultado.rolPermisosFinales.includes('*') ? "['*']" : `[${resultado.rolPermisosFinales.length} permisos]`} — sin cambios.\n`);
    } else {
      console.log(`   ✏  Rol actualizado: ${resultado.rolNombreFinal} con ${resultado.rolPermisosFinales.includes('*') ? "['*']" : `[${resultado.rolPermisosFinales.length} permisos]`}\n`);
    }
  }
}

main().catch(err => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
