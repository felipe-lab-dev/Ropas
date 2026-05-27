/**
 * Lista usuarios existentes en tenant_loremstore (read-only).
 * Uso: pnpm tsx scripts/diagnostico-usuarios-loremstore.ts
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

async function main() {
  const dbUrl = process.env.DATABASE_URL!;
  const tenantSchemaUrl = dbUrl.replace(/schema=public/, 'schema=tenant_loremstore');
  const tenantPrisma = new PrismaClient({ datasourceUrl: tenantSchemaUrl });

  const usuarios = await tenantPrisma.usuario.findMany({
    include: { rol: { select: { nombre: true } } },
    orderBy: { creadoEn: 'asc' },
  });

  console.log(`\n📋 Usuarios en tenant_loremstore (${usuarios.length}):\n`);
  for (const u of usuarios) {
    const hashPrefix = u.passwordHash.substring(0, 4);
    const eliminado = u.eliminadoEn ? `❌ eliminado ${u.eliminadoEn.toISOString()}` : 'vivo';
    const activo = u.activo ? '✓' : '✗';
    console.log(
      `  [${activo}] ${u.nombre.padEnd(40)} ` +
      `dni=${(u.dni ?? 'null').padEnd(12)} ` +
      `email=${u.email.padEnd(35)} ` +
      `rol=${(u.rol?.nombre ?? '-').padEnd(15)} ` +
      `hash=${hashPrefix} ${eliminado}`,
    );
  }
  console.log('');

  await tenantPrisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
