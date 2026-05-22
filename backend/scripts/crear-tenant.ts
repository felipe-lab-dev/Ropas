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
    console.log(`   Guardá la contraseña — solo se muestra una vez.\n`);
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

async function aplicarDdl(prisma: PrismaClient, schema: string): Promise<void> {
  // Cada statement va separado para que no falle si alguno ya existe
  const statements = ddlStatements(schema);
  for (const s of statements) {
    await prisma.$executeRawUnsafe(s);
  }
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

/**
 * DDL del schema de tenant. Cada statement es independiente para que el
 * runner pueda ejecutarlos uno por uno y manejar mejor los errores.
 */
function ddlStatements(s: string): string[] {
  return [
    // pgcrypto omitido: Azure PostgreSQL no permite la extensión sin allow-list,
    // y gen_random_uuid() ya es función nativa en Postgres 13+.
    // Enums
    `DO $$ BEGIN CREATE TYPE "${s}".genero AS ENUM ('hombre','mujer','ninio','ninia','unisex'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".temporada AS ENUM ('primavera','verano','otonio','invierno','todo_el_anio'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".clasificacion_abc AS ENUM ('AA','A','B','C','D'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".tipo_movimiento_stock AS ENUM ('ingreso_compra','ingreso_devolucion','ingreso_ajuste','egreso_venta','egreso_merma','egreso_ajuste','traslado_salida','traslado_entrada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".tipo_documento AS ENUM ('dni','ruc','cpf','cnpj','pasaporte','otro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".estado_venta AS ENUM ('borrador','confirmada','pagada','parcial','anulada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".medio_pago AS ENUM ('efectivo','tarjeta_debito','tarjeta_credito','pix','transferencia','yape','plin','otro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".estado_sesion_caja AS ENUM ('abierta','cerrada','con_diferencia'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".tipo_movimiento_caja AS ENUM ('ingreso','egreso','retiro','ajuste'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // Tablas — orden importa por FKs
    `CREATE TABLE IF NOT EXISTS "${s}".roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre VARCHAR(80) UNIQUE NOT NULL,
      descripcion VARCHAR(240),
      permisos TEXT[] NOT NULL DEFAULT '{}',
      es_sistema BOOLEAN NOT NULL DEFAULT false,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS "${s}".usuarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre VARCHAR(120) NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      dni VARCHAR(20) UNIQUE,
      password_hash VARCHAR(120) NOT NULL,
      rol_id UUID NOT NULL REFERENCES "${s}".roles(id),
      sucursal_defecto UUID,
      activo BOOLEAN NOT NULL DEFAULT true,
      ultimo_ingreso TIMESTAMP,
      preferencias_ui JSONB NOT NULL DEFAULT '{}',
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS usuarios_eliminado_idx ON "${s}".usuarios(eliminado_en)`,

    `CREATE TABLE IF NOT EXISTS "${s}".sucursales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      codigo VARCHAR(20) UNIQUE NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      direccion VARCHAR(240),
      telefono VARCHAR(40),
      es_principal BOOLEAN NOT NULL DEFAULT false,
      activa BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS "${s}".categorias (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre VARCHAR(80) UNIQUE NOT NULL,
      slug VARCHAR(80) UNIQUE NOT NULL,
      padre_id UUID REFERENCES "${s}".categorias(id),
      orden INTEGER NOT NULL DEFAULT 0,
      icono VARCHAR(40),
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS "${s}".marcas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre VARCHAR(80) UNIQUE NOT NULL,
      logo_url VARCHAR(240),
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS "${s}".productos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku VARCHAR(40) UNIQUE NOT NULL,
      codigo VARCHAR(40) UNIQUE,
      nombre VARCHAR(160) NOT NULL,
      descripcion TEXT,
      categoria_id UUID NOT NULL REFERENCES "${s}".categorias(id),
      marca_id UUID REFERENCES "${s}".marcas(id),
      genero "${s}".genero NOT NULL DEFAULT 'unisex',
      temporada "${s}".temporada NOT NULL DEFAULT 'todo_el_anio',
      material VARCHAR(120),
      cuidado VARCHAR(240),
      precio_venta DECIMAL(12,2) NOT NULL,
      precio_compra DECIMAL(12,2),
      imagenes TEXT[] NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      activo BOOLEAN NOT NULL DEFAULT true,
      clasificacion "${s}".clasificacion_abc,
      clasificacion_score DECIMAL(12, 4),
      clasificado_en TIMESTAMP,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS productos_eliminado_idx ON "${s}".productos(eliminado_en)`,
    `CREATE INDEX IF NOT EXISTS productos_categoria_idx ON "${s}".productos(categoria_id)`,

    `CREATE TABLE IF NOT EXISTS "${s}".variantes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      producto_id UUID NOT NULL REFERENCES "${s}".productos(id) ON DELETE CASCADE,
      sku VARCHAR(48) UNIQUE NOT NULL,
      talla VARCHAR(16) NOT NULL,
      color VARCHAR(40) NOT NULL,
      color_hex VARCHAR(7),
      codigo_barras VARCHAR(40) UNIQUE,
      precio_venta DECIMAL(12,2),
      peso_gramos INTEGER,
      imagenes TEXT[] NOT NULL DEFAULT '{}',
      activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP,
      UNIQUE (producto_id, talla, color)
    )`,
    `CREATE INDEX IF NOT EXISTS variantes_eliminado_idx ON "${s}".variantes(eliminado_en)`,

    `CREATE TABLE IF NOT EXISTS "${s}".stock_sucursales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      variante_id UUID NOT NULL REFERENCES "${s}".variantes(id) ON DELETE CASCADE,
      sucursal_id UUID NOT NULL REFERENCES "${s}".sucursales(id),
      disponible INTEGER NOT NULL DEFAULT 0,
      reservado INTEGER NOT NULL DEFAULT 0,
      en_revision INTEGER NOT NULL DEFAULT 0,
      danado INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER NOT NULL DEFAULT 0,
      ubicacion VARCHAR(40),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      UNIQUE(variante_id, sucursal_id)
    )`,
    `CREATE INDEX IF NOT EXISTS stock_sucursal_idx ON "${s}".stock_sucursales(sucursal_id)`,

    `CREATE TABLE IF NOT EXISTS "${s}".movimientos_stock (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      variante_id UUID NOT NULL REFERENCES "${s}".variantes(id),
      sucursal_id UUID NOT NULL,
      tipo "${s}".tipo_movimiento_stock NOT NULL,
      cantidad INTEGER NOT NULL,
      stock_antes INTEGER NOT NULL,
      stock_despues INTEGER NOT NULL,
      referencia_tipo VARCHAR(40),
      referencia_id UUID,
      notas TEXT,
      usuario_id UUID,
      creado_en TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS movimientos_variante_idx ON "${s}".movimientos_stock(variante_id, creado_en)`,
    `CREATE INDEX IF NOT EXISTS movimientos_ref_idx ON "${s}".movimientos_stock(referencia_tipo, referencia_id)`,

    `CREATE TABLE IF NOT EXISTS "${s}".clientes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo_documento "${s}".tipo_documento NOT NULL DEFAULT 'cpf',
      documento VARCHAR(20),
      nombre VARCHAR(160) NOT NULL,
      email VARCHAR(160),
      telefono VARCHAR(40),
      direccion VARCHAR(240),
      ciudad VARCHAR(120),
      fecha_nacimiento DATE,
      notas TEXT,
      total_compras DECIMAL(12,2) NOT NULL DEFAULT 0,
      ultima_compra_en TIMESTAMP,
      tags TEXT[] NOT NULL DEFAULT '{}',
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP,
      UNIQUE (tipo_documento, documento)
    )`,
    `CREATE INDEX IF NOT EXISTS clientes_eliminado_idx ON "${s}".clientes(eliminado_en)`,

    `CREATE TABLE IF NOT EXISTS "${s}".sesiones_caja (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sucursal_id UUID NOT NULL REFERENCES "${s}".sucursales(id),
      cajero_id UUID NOT NULL REFERENCES "${s}".usuarios(id),
      estado "${s}".estado_sesion_caja NOT NULL DEFAULT 'abierta',
      monto_apertura DECIMAL(12,2) NOT NULL,
      monto_cierre DECIMAL(12,2),
      monto_esperado DECIMAL(12,2),
      diferencia DECIMAL(12,2),
      notas_apertura TEXT,
      notas_cierre TEXT,
      abierta_en TIMESTAMP NOT NULL DEFAULT now(),
      cerrada_en TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS sesiones_caja_idx ON "${s}".sesiones_caja(sucursal_id, abierta_en)`,

    `CREATE TABLE IF NOT EXISTS "${s}".movimientos_caja (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sesion_id UUID NOT NULL REFERENCES "${s}".sesiones_caja(id),
      tipo "${s}".tipo_movimiento_caja NOT NULL,
      monto DECIMAL(12,2) NOT NULL,
      motivo VARCHAR(240) NOT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS "${s}".ventas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      numero VARCHAR(20) UNIQUE NOT NULL,
      sucursal_id UUID NOT NULL REFERENCES "${s}".sucursales(id),
      cliente_id UUID REFERENCES "${s}".clientes(id),
      vendedor_id UUID NOT NULL REFERENCES "${s}".usuarios(id),
      estado "${s}".estado_venta NOT NULL DEFAULT 'confirmada',
      subtotal DECIMAL(12,2) NOT NULL,
      descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
      impuestos DECIMAL(12,2) NOT NULL DEFAULT 0,
      total DECIMAL(12,2) NOT NULL,
      total_pagado DECIMAL(12,2) NOT NULL DEFAULT 0,
      notas TEXT,
      sesion_caja_id UUID REFERENCES "${s}".sesiones_caja(id),
      anulada_en TIMESTAMP,
      motivo_anulacion TEXT,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS ventas_sucursal_idx ON "${s}".ventas(sucursal_id, creado_en)`,
    `CREATE INDEX IF NOT EXISTS ventas_cliente_idx ON "${s}".ventas(cliente_id)`,

    `CREATE TABLE IF NOT EXISTS "${s}".venta_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venta_id UUID NOT NULL REFERENCES "${s}".ventas(id) ON DELETE CASCADE,
      variante_id UUID NOT NULL REFERENCES "${s}".variantes(id),
      descripcion VARCHAR(240) NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario DECIMAL(12,2) NOT NULL,
      descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(12,2) NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS venta_items_idx ON "${s}".venta_items(venta_id)`,

    `CREATE TABLE IF NOT EXISTS "${s}".venta_pagos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venta_id UUID NOT NULL REFERENCES "${s}".ventas(id) ON DELETE CASCADE,
      medio "${s}".medio_pago NOT NULL,
      monto DECIMAL(12,2) NOT NULL,
      referencia VARCHAR(120),
      recibido_en TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS venta_pagos_idx ON "${s}".venta_pagos(venta_id)`,

    // ─────────────────────── COMPRAS Y PROVEEDORES ─────────────────────
    `DO $$ BEGIN CREATE TYPE "${s}".condicion_pago AS ENUM ('contado','credito_15','credito_30','credito_60','credito_otro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".tipo_comprobante_compra AS ENUM ('factura','boleta','nota_ingreso','guia_remision','recibo_honorarios','otro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".estado_compra AS ENUM ('borrador','recibida','anulada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".estado_pago_compra AS ENUM ('pendiente','parcial','pagada','vencida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    `CREATE TABLE IF NOT EXISTS "${s}".proveedores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo_documento "${s}".tipo_documento NOT NULL DEFAULT 'ruc',
      documento VARCHAR(20) NOT NULL,
      razon_social VARCHAR(200) NOT NULL,
      nombre_comercial VARCHAR(160),
      contacto VARCHAR(120),
      email VARCHAR(160),
      telefono VARCHAR(40),
      direccion VARCHAR(240),
      ciudad VARCHAR(120),
      condicion_pago "${s}".condicion_pago NOT NULL DEFAULT 'contado',
      dias_credito INTEGER NOT NULL DEFAULT 0,
      cuenta_bancaria VARCHAR(60),
      activo BOOLEAN NOT NULL DEFAULT true,
      notas TEXT,
      total_comprado DECIMAL(14,2) NOT NULL DEFAULT 0,
      deuda_actual DECIMAL(14,2) NOT NULL DEFAULT 0,
      ultima_compra_en TIMESTAMP,
      tags TEXT[] NOT NULL DEFAULT '{}',
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP,
      UNIQUE (tipo_documento, documento)
    )`,
    `CREATE INDEX IF NOT EXISTS proveedores_eliminado_idx ON "${s}".proveedores(eliminado_en)`,

    `CREATE TABLE IF NOT EXISTS "${s}".compras (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      numero VARCHAR(20) UNIQUE NOT NULL,
      proveedor_id UUID NOT NULL REFERENCES "${s}".proveedores(id),
      sucursal_id UUID NOT NULL REFERENCES "${s}".sucursales(id),
      tipo_comprobante "${s}".tipo_comprobante_compra NOT NULL,
      serie VARCHAR(10) NOT NULL,
      numero_comprobante VARCHAR(20) NOT NULL,
      fecha_emision DATE NOT NULL,
      fecha_recepcion DATE NOT NULL,
      moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
      tipo_cambio DECIMAL(10,4) NOT NULL DEFAULT 1,
      subtotal DECIMAL(14,2) NOT NULL,
      igv DECIMAL(14,2) NOT NULL DEFAULT 0,
      otros_impuestos DECIMAL(14,2) NOT NULL DEFAULT 0,
      descuento DECIMAL(14,2) NOT NULL DEFAULT 0,
      total DECIMAL(14,2) NOT NULL,
      estado "${s}".estado_compra NOT NULL DEFAULT 'borrador',
      estado_pago "${s}".estado_pago_compra NOT NULL DEFAULT 'pendiente',
      condicion_pago "${s}".condicion_pago NOT NULL DEFAULT 'contado',
      fecha_vencimiento DATE,
      total_pagado DECIMAL(14,2) NOT NULL DEFAULT 0,
      notas TEXT,
      usuario_id UUID NOT NULL,
      anulada_en TIMESTAMP,
      motivo_anulacion TEXT,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP,
      UNIQUE (proveedor_id, tipo_comprobante, serie, numero_comprobante)
    )`,
    `CREATE INDEX IF NOT EXISTS compras_sucursal_idx ON "${s}".compras(sucursal_id, fecha_emision)`,
    `CREATE INDEX IF NOT EXISTS compras_estado_pago_idx ON "${s}".compras(estado_pago, fecha_vencimiento)`,
    `CREATE INDEX IF NOT EXISTS compras_eliminado_idx ON "${s}".compras(eliminado_en)`,

    `CREATE TABLE IF NOT EXISTS "${s}".compra_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      compra_id UUID NOT NULL REFERENCES "${s}".compras(id) ON DELETE CASCADE,
      variante_id UUID NOT NULL REFERENCES "${s}".variantes(id),
      descripcion VARCHAR(240) NOT NULL,
      cantidad INTEGER NOT NULL,
      costo_unitario DECIMAL(14,4) NOT NULL,
      descuento DECIMAL(14,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(14,2) NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS compra_items_idx ON "${s}".compra_items(compra_id)`,

    `CREATE TABLE IF NOT EXISTS "${s}".pagos_compra (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      compra_id UUID NOT NULL REFERENCES "${s}".compras(id) ON DELETE CASCADE,
      medio "${s}".medio_pago NOT NULL,
      monto DECIMAL(14,2) NOT NULL,
      referencia VARCHAR(120),
      fecha_pago DATE NOT NULL,
      sesion_caja_id UUID,
      usuario_id UUID NOT NULL,
      notas TEXT,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      eliminado_en TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS pagos_compra_idx ON "${s}".pagos_compra(compra_id)`,

    // ─────────────────────── CONTABILIDAD ───────────────────────────────
    `DO $$ BEGIN CREATE TYPE "${s}".naturaleza_cuenta AS ENUM ('deudora','acreedora'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".tipo_cuenta AS ENUM ('activo','pasivo','patrimonio','ingreso','gasto','costo','orden'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".estado_periodo AS ENUM ('abierto','cerrado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".estado_asiento AS ENUM ('asentado','anulado','revertido'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN CREATE TYPE "${s}".tipo_operacion_sunat AS ENUM (
      'venta_gravada','venta_exonerada','venta_inafecta','venta_exportacion',
      'compra_gravada','compra_no_gravada','compra_importacion',
      'pago_proveedor','cobro_cliente',
      'apertura_caja','cierre_caja','gasto_caja',
      'ajuste_inventario','nota_credito','nota_debito',
      'asiento_manual','asiento_cierre'
    ); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    `CREATE TABLE IF NOT EXISTS "${s}".plan_cuentas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      codigo VARCHAR(12) UNIQUE NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      nivel INTEGER NOT NULL,
      padre_codigo VARCHAR(12),
      naturaleza "${s}".naturaleza_cuenta NOT NULL,
      tipo "${s}".tipo_cuenta NOT NULL,
      acepta_movimiento BOOLEAN NOT NULL DEFAULT true,
      activa BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS plan_cuentas_padre_idx ON "${s}".plan_cuentas(padre_codigo)`,
    `CREATE INDEX IF NOT EXISTS plan_cuentas_tipo_idx ON "${s}".plan_cuentas(tipo)`,

    `CREATE TABLE IF NOT EXISTS "${s}".periodos_contables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      anio INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      estado "${s}".estado_periodo NOT NULL DEFAULT 'abierto',
      cerrado_en TIMESTAMP,
      cerrado_por_id UUID,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      UNIQUE (anio, mes)
    )`,

    `CREATE TABLE IF NOT EXISTS "${s}".asientos_contables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      numero VARCHAR(30) UNIQUE NOT NULL,
      periodo_id UUID NOT NULL REFERENCES "${s}".periodos_contables(id),
      fecha DATE NOT NULL,
      glosa VARCHAR(400) NOT NULL,
      tipo_operacion "${s}".tipo_operacion_sunat NOT NULL,
      origen_tipo VARCHAR(40),
      origen_id UUID,
      total_debe DECIMAL(14,2) NOT NULL,
      total_haber DECIMAL(14,2) NOT NULL,
      moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
      tipo_cambio DECIMAL(10,4) NOT NULL DEFAULT 1,
      estado "${s}".estado_asiento NOT NULL DEFAULT 'asentado',
      reversa_de_id UUID,
      usuario_id UUID NOT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS asientos_periodo_idx ON "${s}".asientos_contables(periodo_id, fecha)`,
    `CREATE INDEX IF NOT EXISTS asientos_origen_idx ON "${s}".asientos_contables(origen_tipo, origen_id)`,

    `CREATE TABLE IF NOT EXISTS "${s}".asiento_detalles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asiento_id UUID NOT NULL REFERENCES "${s}".asientos_contables(id) ON DELETE CASCADE,
      cuenta_codigo VARCHAR(12) NOT NULL REFERENCES "${s}".plan_cuentas(codigo),
      glosa VARCHAR(240),
      debe DECIMAL(14,2) NOT NULL DEFAULT 0,
      haber DECIMAL(14,2) NOT NULL DEFAULT 0,
      documento_tipo VARCHAR(10),
      documento_numero VARCHAR(30),
      orden INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS asiento_detalles_asiento_idx ON "${s}".asiento_detalles(asiento_id)`,
    `CREATE INDEX IF NOT EXISTS asiento_detalles_cuenta_idx ON "${s}".asiento_detalles(cuenta_codigo)`,

    `CREATE TABLE IF NOT EXISTS "${s}".audit_log (
      id BIGSERIAL PRIMARY KEY,
      modulo VARCHAR(40) NOT NULL,
      accion VARCHAR(40) NOT NULL,
      entidad_id UUID,
      usuario_id UUID,
      cambios JSONB,
      ip VARCHAR(45),
      creado_en TIMESTAMP NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS audit_log_modulo_idx ON "${s}".audit_log(modulo, creado_en)`,
  ];
}

main().catch(err => {
  console.error('❌ Error creando tenant:', err);
  process.exit(1);
});
