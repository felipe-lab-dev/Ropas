/**
 * Aplica TODAS las migrations de prisma/migrations/ al schema tenant_loremstore.
 * Usa PrismaClient + parser de statements (separa por `;` cuidando $$ blocks).
 * Cada statement va con try/catch individual — fallos no rompen al resto.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2] ?? '';
  }
}

// Parser de statements SQL respetando $$...$$, $tag$...$tag$, y -- comentarios.
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let i = 0;
  let inDollar: string | null = null; // null = fuera, "$$" / "$tag$" = dentro
  let inLineComment = false;
  let inBlockComment = false;
  let inSingleQ = false;
  let inDoubleQ = false;

  while (i < sql.length) {
    const c = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (inLineComment) {
      buf += c;
      if (c === '\n') inLineComment = false;
      i++; continue;
    }
    if (inBlockComment) {
      buf += c;
      if (next2 === '*/') { buf += '/'; i += 2; inBlockComment = false; continue; }
      i++; continue;
    }
    if (inSingleQ) {
      buf += c;
      if (c === "'" && sql[i + 1] !== "'") inSingleQ = false;
      else if (c === "'" && sql[i + 1] === "'") { buf += "'"; i++; }
      i++; continue;
    }
    if (inDoubleQ) {
      buf += c;
      if (c === '"') inDoubleQ = false;
      i++; continue;
    }
    if (inDollar) {
      buf += c;
      if (sql.startsWith(inDollar, i)) {
        buf += inDollar.slice(1);
        i += inDollar.length;
        inDollar = null;
        continue;
      }
      i++; continue;
    }

    if (next2 === '--') { inLineComment = true; buf += c; i++; continue; }
    if (next2 === '/*') { inBlockComment = true; buf += c; i++; continue; }
    if (c === "'") { inSingleQ = true; buf += c; i++; continue; }
    if (c === '"') { inDoubleQ = true; buf += c; i++; continue; }

    // Detecta $$ o $tag$
    if (c === '$') {
      const m = sql.slice(i).match(/^\$([A-Za-z_]\w*)?\$/);
      if (m) {
        inDollar = m[0];
        buf += m[0];
        i += m[0].length;
        continue;
      }
    }

    if (c === ';') {
      const trimmed = buf.trim();
      if (trimmed) out.push(trimmed);
      buf = '';
      i++; continue;
    }

    buf += c;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

(async () => {
  // PrismaClient explícitamente con search_path=tenant_loremstore
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', 'tenant_loremstore');
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');
  const dirs = readdirSync(migrationsDir)
    .filter(d => statSync(join(migrationsDir, d)).isDirectory())
    .filter(d => /^\d{8}_/.test(d))
    .sort();

  console.log(`Aplicando ${dirs.length} migraciones a tenant_loremstore (orden cronológico)\n`);

  const resumen: any[] = [];
  for (const mig of dirs) {
    const sqlPath = join(migrationsDir, mig, 'migration.sql');
    if (!existsSync(sqlPath)) {
      resumen.push({ migration: mig, ok: 0, errores: 0, nota: 'no migration.sql' });
      continue;
    }
    const sql = readFileSync(sqlPath, 'utf-8');
    const stmts = splitStatements(sql);
    let ok = 0, fail = 0;
    const erroresMsg: string[] = [];

    for (const stmt of stmts) {
      try {
        await p.$executeRawUnsafe(stmt);
        ok++;
      } catch (e: any) {
        fail++;
        const m = (e?.message || String(e)).split('\n').filter(Boolean)[0]?.slice(0, 140);
        if (m) erroresMsg.push(m);
      }
    }
    resumen.push({
      migration: mig,
      ok,
      errores: fail,
      muestra_error: erroresMsg[0] ?? '',
    });
  }

  console.table(resumen);

  // Resumen final
  const totalOk = resumen.reduce((s, r) => s + r.ok, 0);
  const totalErr = resumen.reduce((s, r) => s + r.errores, 0);
  console.log(`\nTotal: ${totalOk} statements OK, ${totalErr} con error (esperado: muchos errores por "ya existe" en migrations ya aplicadas)`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
