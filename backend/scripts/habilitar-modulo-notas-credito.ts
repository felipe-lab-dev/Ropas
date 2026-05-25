/**
 * Agrega "notas-credito" al array `modulos_habilitados` de todos los tenants
 * que aún no lo tengan.
 *
 *   Uso: pnpm exec tsx scripts/habilitar-modulo-notas-credito.ts
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

async function main() {
  const p = new PrismaClient();
  const upd: Array<{ codigo: string }> = await p.$queryRawUnsafe(`
    UPDATE "tenants"
    SET modulos_habilitados = (
      SELECT jsonb_agg(DISTINCT m)
      FROM jsonb_array_elements_text(modulos_habilitados || '["notas-credito"]'::jsonb) m
    )
    WHERE NOT modulos_habilitados @> '["notas-credito"]'::jsonb
    RETURNING codigo;
  `);
  console.log(`✅ "notas-credito" habilitado en ${upd.length} tenant(s): ${upd.map(t => t.codigo).join(', ') || '(ninguno requería cambio)'}`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
