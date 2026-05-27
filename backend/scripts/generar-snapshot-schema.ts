/**
 * Genera el snapshot SQL del schema de tenant desde schema.prisma.
 * Ejecutar con: pnpm schema:snapshot
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const SCHEMA_PATH = join(ROOT, 'prisma', 'schema.prisma');
const SNAPSHOT_DIR = join(ROOT, 'prisma', 'snapshot');
const SNAPSHOT_PATH = join(SNAPSHOT_DIR, 'schema-tenant.sql');

/** Tablas que viven en public, NO en schemas tenant. */
const TABLAS_PUBLICAS = new Set(['tenants', 'tenant_audit']);

// ─── Ejecutar prisma migrate diff ──────────────────────────────────────────
function obtenerSqlBase(): string {
  const cmd = `pnpm exec prisma migrate diff --from-empty --to-schema-datamodel "${SCHEMA_PATH}" --script`;
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' });
}

// ─── Partir SQL en sentencias completas (respetando bloques multi-línea) ──
function partirEnSentencias(sql: string): string[] {
  const sentencias: string[] = [];
  let buffer = '';
  let profundidad = 0; // para bloques $$ ... $$
  let dentroBlock = false;

  for (const linea of sql.split(/\r?\n/)) {
    // Detectar inicio de DO $$ / $$ block
    if (/^\s*DO\s+\$\$/i.test(linea)) {
      dentroBlock = true;
      profundidad++;
    } else if (dentroBlock && /\$\$/.test(linea)) {
      profundidad--;
      if (profundidad <= 0) {
        dentroBlock = false;
        profundidad = 0;
      }
    }

    buffer += linea + '\n';

    if (!dentroBlock && linea.trimEnd().endsWith(';')) {
      sentencias.push(buffer.trim());
      buffer = '';
    }
  }
  if (buffer.trim()) sentencias.push(buffer.trim());
  return sentencias;
}

// ─── Detectar si una sentencia pertenece a una tabla pública ──────────────
function esDeTablasPublicas(sentencia: string): boolean {
  // CREATE TABLE "tenants" / "tenant_audit"
  for (const tabla of TABLAS_PUBLICAS) {
    if (new RegExp(`CREATE\\s+TABLE\\s+"${tabla}"`, 'i').test(sentencia)) return true;
    // Indexes ON "tenants" o ON "tenant_audit"
    if (new RegExp(`\\bON\\s+"${tabla}"`, 'i').test(sentencia)) return true;
    // AddForeignKey REFERENCES "tenants"/"tenant_audit"
    if (new RegExp(`REFERENCES\\s+"${tabla}"`, 'i').test(sentencia)) return true;
    // AlterTable solo si la tabla principal es pública
    if (new RegExp(`ALTER\\s+TABLE\\s+"${tabla}"`, 'i').test(sentencia)) return true;
  }
  // CREATE SCHEMA IF NOT EXISTS "public"
  if (/CREATE\s+SCHEMA\s+.*"public"/i.test(sentencia)) return true;
  // Enum exclusivo de public: tenant_estado
  if (/CREATE\s+TYPE\s+"tenant_estado"/i.test(sentencia)) return true;
  return false;
}

// ─── Hacer idempotente ────────────────────────────────────────────────────
function hacerIdempotente(sentencia: string): string {
  let s = sentencia;

  // CREATE TABLE "X" → CREATE TABLE IF NOT EXISTS "X"
  s = s.replace(/\bCREATE TABLE "([^"]+)"/g, 'CREATE TABLE IF NOT EXISTS "$1"');

  // CREATE UNIQUE INDEX "X" → CREATE UNIQUE INDEX IF NOT EXISTS "X"
  s = s.replace(/\bCREATE UNIQUE INDEX "([^"]+)"/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "$1"');

  // CREATE INDEX "X" → CREATE INDEX IF NOT EXISTS "X"
  s = s.replace(/\bCREATE INDEX "([^"]+)"/g, 'CREATE INDEX IF NOT EXISTS "$1"');

  // CREATE TYPE "X" AS ENUM (...); → DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  // Solo sentencias simples (una línea con ;)
  s = s.replace(
    /^CREATE TYPE "([^"]+)" AS ENUM \([^)]+\);$/m,
    (match) =>
      `DO $$ BEGIN\n  ${match}\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;`,
  );

  return s;
}

// ─── Construir comentario de sección desde comentario anterior ────────────
// El SQL de Prisma usa comentarios como: -- CreateTable, -- CreateIndex, etc.
// Los preservamos tal cual, excepto los que acompañan sentencias filtradas.

// ─── Main ─────────────────────────────────────────────────────────────────
function main() {
  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(`No se encontró schema.prisma en ${SCHEMA_PATH}`);
  }

  console.log('▶ Ejecutando prisma migrate diff...');
  const sqlBase = obtenerSqlBase();

  console.log('▶ Partiendo en sentencias y filtrando tablas de public...');
  const sentencias = partirEnSentencias(sqlBase);

  const retenidas: string[] = [];
  for (const sentencia of sentencias) {
    if (esDeTablasPublicas(sentencia)) continue;
    retenidas.push(hacerIdempotente(sentencia));
  }

  // Verificación rápida
  const contenidoVerif = retenidas.join('\n');
  for (const tabla of TABLAS_PUBLICAS) {
    const regex = new RegExp(`CREATE TABLE[^"]*"${tabla}"`, 'i');
    if (regex.test(contenidoVerif)) {
      console.warn(`⚠  ADVERTENCIA: "${tabla}" sigue presente en el snapshot`);
    }
  }

  const cabecera = [
    '-- GENERADO AUTOMÁTICAMENTE — NO EDITAR A MANO.',
    '-- Regenerar con `pnpm schema:snapshot`.',
    `-- Generado el: ${new Date().toISOString()}`,
    '',
  ].join('\n');

  const contenidoFinal = cabecera + '\n' + retenidas.join('\n\n') + '\n';

  if (!existsSync(SNAPSHOT_DIR)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  writeFileSync(SNAPSHOT_PATH, contenidoFinal, 'utf-8');

  const bytes = Buffer.byteLength(contenidoFinal, 'utf-8');
  const tablas = (contenidoFinal.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length;
  const tipos = (contenidoFinal.match(/CREATE TYPE/g) ?? []).length;

  console.log(
    `✓ Snapshot generado: prisma/snapshot/schema-tenant.sql (${bytes} bytes, ${tablas} tablas, ${tipos} tipos)`,
  );
}

main();
