/**
 * Crea el usuario Favio Josue Zamata Saldivar en el tenant loremstore con acceso total.
 * Uso: pnpm tsx scripts/crear-usuario-favio.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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

  const rolAdmin = await tenantPrisma.rol.findFirst({ where: { nombre: 'Administrador' } });
  if (!rolAdmin) throw new Error('No existe rol "Administrador" en tenant_loremstore');

  const passwordHash = await bcrypt.hash('75136140', 10);
  const usuario = await tenantPrisma.usuario.upsert({
    where: { email: 'favio@loremstore.com' },
    update: { passwordHash, activo: true },
    create: {
      nombre: 'Favio Josue Zamata Saldivar',
      email: 'favio@loremstore.com',
      dni: '75136140',
      passwordHash,
      rolId: rolAdmin.id,
      activo: true,
    },
  });

  console.log('\n✅ Usuario creado/actualizado:');
  console.log(`   Nombre:   ${usuario.nombre}`);
  console.log(`   Email:    ${usuario.email}`);
  console.log(`   DNI:      ${usuario.dni}`);
  console.log(`   Rol:      admin (acceso total)`);
  console.log(`   Password: 75136140`);
  console.log(`   Login en: https://loremstore.tienda.enkihubs.com/login\n`);

  await tenantPrisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
