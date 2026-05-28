/**
 * Reasigna el plan de un tenant existente: actualiza `planNombre` +
 * reemplaza `modulosHabilitados` por la lista del nuevo plan.
 *
 * Uso:
 *   pnpm tenant:plan -- --code mi-tienda --plan fiscal
 *   pnpm tenant:plan -- --code loremstore --plan full
 *
 * ⚠️ Reemplaza el array completo. Si querés activar/desactivar UN módulo,
 * usá `pnpm tenant:modulo` en su lugar.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLANES, esPlanValido, PlanId } from '../src/saas/catalogo-planes';

cargarEnv();

function cargarEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
}

interface Args { code: string; plan: PlanId }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const code = get('code');
  const plan = get('plan');

  if (!code || !plan) {
    console.error('Uso: --code <codigo> --plan <basico|comercial|fiscal|full>');
    process.exit(1);
  }
  if (!esPlanValido(plan)) {
    console.error(`Plan inválido: "${plan}". Valores permitidos: ${Object.keys(PLANES).join(', ')}`);
    process.exit(1);
  }
  return { code, plan };
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const t = await prisma.tenant.findUnique({
      where: { codigo: args.code },
      select: { id: true, codigo: true, planNombre: true, modulosHabilitados: true },
    });
    if (!t) {
      console.error(`No existe el tenant "${args.code}"`);
      process.exit(1);
    }
    const nuevos = [...PLANES[args.plan]];
    await prisma.tenant.update({
      where: { id: t.id },
      data: {
        planNombre: args.plan,
        modulosHabilitados: nuevos,
      },
    });
    console.log(`✅ Tenant "${args.code}" reasignado al plan "${args.plan}" (${nuevos.length} módulos).`);
    console.log(`   plan anterior: ${t.planNombre ?? '-'}`);
    console.log(`   módulos antes: ${JSON.stringify(t.modulosHabilitados)}`);
    console.log(`   módulos ahora: ${JSON.stringify(nuevos)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });
