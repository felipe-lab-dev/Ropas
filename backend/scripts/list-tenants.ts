import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
}

import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  const t = await p.tenant.findMany({
    select: { codigo: true, nombre: true, schemaName: true, estado: true },
  });
  console.log(JSON.stringify(t, null, 2));
  await p.$disconnect();
}
main().catch(console.error);
