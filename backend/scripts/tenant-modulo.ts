/**
 * Activa o desactiva un módulo individual en un tenant existente.
 *
 * Uso:
 *   pnpm tenant:modulo -- --code mi-tienda --activar facturacion-electronica
 *   pnpm tenant:modulo -- --code mi-tienda --desactivar cupones
 *
 * Reemplaza el array `modulos_habilitados` en `public.tenants`.
 * No re-aplica un plan completo: solo toca el módulo indicado. Para reasignar
 * todos los módulos del plan contratado, usar `pnpm tenant:plan`.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO_MODULOS, esModuloValido, ModuloId, TODOS_LOS_MODULOS } from '../src/saas/catalogo-modulos';

cargarEnv();

function cargarEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
}

interface Args { code: string; activar?: ModuloId; desactivar?: ModuloId }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const code = get('code');
  const activar = get('activar');
  const desactivar = get('desactivar');

  if (!code || (!activar && !desactivar)) {
    console.error('Uso: --code <codigo> ( --activar <modulo> | --desactivar <modulo> )');
    console.error(`Módulos válidos: ${TODOS_LOS_MODULOS.join(', ')}`);
    process.exit(1);
  }
  if (activar && desactivar) {
    console.error('Pasá solo uno: --activar o --desactivar.');
    process.exit(1);
  }
  const modulo = activar ?? desactivar!;
  if (!esModuloValido(modulo)) {
    console.error(`Módulo desconocido: "${modulo}". Válidos: ${TODOS_LOS_MODULOS.join(', ')}`);
    process.exit(1);
  }
  return {
    code,
    activar: activar ? (activar as ModuloId) : undefined,
    desactivar: desactivar ? (desactivar as ModuloId) : undefined,
  };
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const t = await prisma.tenant.findUnique({
      where: { codigo: args.code },
      select: { id: true, codigo: true, modulosHabilitados: true },
    });
    if (!t) {
      console.error(`No existe el tenant "${args.code}"`);
      process.exit(1);
    }
    const actuales = (Array.isArray(t.modulosHabilitados) ? t.modulosHabilitados : []) as string[];
    let nuevos: string[];
    if (args.activar) {
      if (actuales.includes(args.activar)) {
        console.log(`✓ ${args.code} ya tenía "${args.activar}". No-op.`);
        return;
      }
      nuevos = [...actuales, args.activar].sort();
    } else {
      if (!actuales.includes(args.desactivar!)) {
        console.log(`✓ ${args.code} no tenía "${args.desactivar}". No-op.`);
        return;
      }
      nuevos = actuales.filter(m => m !== args.desactivar).sort();
    }

    await prisma.tenant.update({
      where: { id: t.id },
      data: { modulosHabilitados: nuevos },
    });

    console.log(`✅ Tenant "${args.code}" actualizado.`);
    console.log(`   antes: ${JSON.stringify(actuales)}`);
    console.log(`   ahora: ${JSON.stringify(nuevos)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });

// Referencia para evitar warning de import no usado: el catálogo se usa
// indirectamente vía esModuloValido + TODOS_LOS_MODULOS, pero exportamos
// CATALOGO_MODULOS por si scripts encadenados lo necesitan.
void CATALOGO_MODULOS;
