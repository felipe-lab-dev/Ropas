/**
 * Crea un tenant nuevo en local o staging:
 *   1. Crea el schema PostgreSQL `tenant_<code>`
 *   2. Aplica las tablas DDL al schema nuevo
 *   3. Inserta seed: rol admin, sucursal principal, categorías base, usuario admin
 *   4. Registra metadata en `public.tenants`
 *
 * Uso:
 *   pnpm tenant:crear -- --code mi-tienda --nombre "Mi Tienda S.A.C." --admin admin@mi-tienda.com
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

cargarEnv();

function cargarEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const linea of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m && m[1] && !process.env[m[1]]) {
      process.env[m[1]] = m[2] ?? '';
    }
  }
}

interface Args { code: string; nombre: string; admin: string; dni?: string; password?: string }

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const code = get('code');
  const nombre = get('nombre');
  const admin = get('admin') ?? `admin@${code}.local`;
  if (!code || !nombre) {
    console.error('Uso: --code <codigo> --nombre "Nombre legible" [--admin email] [--dni 12345678] [--password pass]');
    process.exit(1);
  }
  return { code, nombre, admin, dni: get('dni'), password: get('password') };
}

const CATEGORIAS_BASE = [
  { nombre: 'Camisas', slug: 'camisas', icono: 'shirt', orden: 1 },
  { nombre: 'Pantalones', slug: 'pantalones', icono: 'pants', orden: 2 },
  { nombre: 'Vestidos', slug: 'vestidos', icono: 'dress', orden: 3 },
  { nombre: 'Faldas', slug: 'faldas', icono: 'skirt', orden: 4 },
  { nombre: 'Polos', slug: 'polos', icono: 'tshirt', orden: 5 },
  { nombre: 'Abrigos', slug: 'abrigos', icono: 'coat', orden: 6 },
  { nombre: 'Calzado', slug: 'calzado', icono: 'shoe', orden: 7 },
  { nombre: 'Accesorios', slug: 'accesorios', icono: 'bag', orden: 8 },
];

const PERMISOS_ADMIN = ['*'];
const MODULOS = [
  'productos', 'inventario', 'ventas', 'caja', 'clientes',
  'proveedores', 'compras', 'contabilidad', 'reportes', 'usuarios', 'configuracion',
  'cupones', 'notas-credito',
];

async function main() {
  const args = parseArgs();
  const schema = `tenant_${args.code.replace(/-/g, '_')}`;
  const password = args.password ?? generarPassword();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurado en .env');
  }

  console.log(`▶ Creando tenant "${args.code}" → schema "${schema}"`);

  const passwordHash = await bcrypt.hash(password, 10);
  const prismaPublic = new PrismaClient();

  try {
    await prismaPublic.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    console.log(`  ✓ Schema ${schema} creado`);

    await prismaPublic.$executeRawUnsafe(`SET search_path TO "${schema}"`);
    await aplicarDdl(prismaPublic, schema);
    console.log(`  ✓ Tablas aplicadas`);

    await sembrar(prismaPublic, schema, args.admin, passwordHash, args.dni);
    console.log(`  ✓ Seed (rol admin, sucursal principal, categorías base, usuario admin)`);

    await sembrarPlanCuentas(prismaPublic, schema);
    console.log(`  ✓ Plan de cuentas PCGE`);

    await prismaPublic.tenant.upsert({
      where: { codigo: args.code },
      create: {
        codigo: args.code,
        nombre: args.nombre,
        schemaName: schema,
        estado: 'activo',
        planNombre: 'Local Dev',
        modulosHabilitados: MODULOS,
      },
      update: { nombre: args.nombre, schemaName: schema, estado: 'activo' },
    });
    console.log(`  ✓ Registrado en public.tenants`);

    console.log(`\n✅ Tenant "${args.code}" creado con éxito\n`);
    console.log(`   Schema:    ${schema}`);
    console.log(`   Admin:     ${args.admin}`);
    console.log(`   Password:  ${password}\n`);
    console.log(`   Guarda la contraseña — solo se muestra una vez.\n`);
  } finally {
    await prismaPublic.$disconnect();
  }
}

function generarPassword(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  const bytes = new Uint8Array(16);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('crypto').randomFillSync(bytes);
  for (const b of bytes) p += charset[b % charset.length];
  return p;
}

async function aplicarDdl(prisma: PrismaClient, _schema: string): Promise<void> {
  const snapshotPath = join(__dirname, '..', 'prisma', 'snapshot', 'schema-tenant.sql');
  if (!existsSync(snapshotPath)) {
    throw new Error(
      `No existe el snapshot ${snapshotPath}. Corré "pnpm schema:snapshot" primero.`,
    );
  }
  const sql = readFileSync(snapshotPath, 'utf-8');
  const sentencias = partirSql(sql);
  for (const s of sentencias) {
    if (s.trim()) await prisma.$executeRawUnsafe(s);
  }
}

/**
 * Parte un script SQL en sentencias completas respetando bloques DO $$...$$.
 */
function partirSql(sql: string): string[] {
  const sentencias: string[] = [];
  let buffer = '';
  let dentroDoBlock = false;
  for (const linea of sql.split(/\r?\n/)) {
    if (/^DO\s+\$\$/i.test(linea.trim())) dentroDoBlock = true;
    buffer += linea + '\n';
    if (dentroDoBlock) {
      if (/END\s+\$\$;\s*$/i.test(linea.trim())) {
        sentencias.push(buffer.trim());
        buffer = '';
        dentroDoBlock = false;
      }
    } else if (linea.trim().endsWith(';')) {
      sentencias.push(buffer.trim());
      buffer = '';
    }
  }
  if (buffer.trim()) sentencias.push(buffer.trim());
  return sentencias;
}

async function sembrar(
  prisma: PrismaClient,
  schema: string,
  email: string,
  passwordHash: string,
  dni: string | undefined,
): Promise<void> {
  const permisos = PERMISOS_ADMIN.map(p => `'${p}'`).join(',');

  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schema}".roles (id, nombre, descripcion, permisos, es_sistema, creado_en, actualizado_en)
    VALUES (gen_random_uuid(), 'Administrador', 'Acceso total al sistema',
            ARRAY[${permisos}]::text[], true, now(), now())
    ON CONFLICT (nombre) DO NOTHING
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schema}".sucursales (id, codigo, nombre, es_principal, activa, creado_en, actualizado_en)
    VALUES (gen_random_uuid(), 'PRINCIPAL', 'Sucursal Principal', true, true, now(), now())
    ON CONFLICT (codigo) DO NOTHING
  `);

  const dniSql = dni ? `'${dni}'` : 'NULL';
  await prisma.$executeRawUnsafe(`
    INSERT INTO "${schema}".usuarios (id, nombre, email, dni, password_hash, rol_id, activo, creado_en, actualizado_en)
    SELECT gen_random_uuid(), 'Administrador', '${email}', ${dniSql}, '${passwordHash}', r.id, true, now(), now()
    FROM "${schema}".roles r WHERE r.nombre = 'Administrador'
    ON CONFLICT (email) DO NOTHING
  `);

  for (const c of CATEGORIAS_BASE) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".categorias (id, nombre, slug, orden, icono, creado_en, actualizado_en)
      VALUES (gen_random_uuid(), '${c.nombre}', '${c.slug}', ${c.orden}, '${c.icono}', now(), now())
      ON CONFLICT (nombre) DO NOTHING
    `);
  }
}

async function sembrarPlanCuentas(prisma: PrismaClient, schema: string): Promise<void> {
  // Import dinámico para evitar acoplar el script al build del backend.
  const { PLAN_CUENTAS } = await import('../src/modules/contabilidad/plan-cuentas.seed');
  for (const c of PLAN_CUENTAS) {
    const padre = c.padreCodigo ? `'${c.padreCodigo}'` : 'NULL';
    await prisma.$executeRawUnsafe(`
      INSERT INTO "${schema}".plan_cuentas
        (id, codigo, nombre, nivel, padre_codigo, naturaleza, tipo, acepta_movimiento, activa, creado_en, actualizado_en)
      VALUES
        (gen_random_uuid(), '${c.codigo}', $$${c.nombre}$$, ${c.nivel}, ${padre},
         '${c.naturaleza}'::"${schema}".naturaleza_cuenta,
         '${c.tipo}'::"${schema}".tipo_cuenta,
         ${c.aceptaMovimiento}, true, now(), now())
      ON CONFLICT (codigo) DO NOTHING
    `);
  }
}


main().catch(err => {
  console.error('❌ Error creando tenant:', err);
  process.exit(1);
});
