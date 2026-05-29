/**
 * Seed CURADO: exactamente 10 productos con kardex coherente.
 *
 * - Soft-elimina todos los productos previos (eliminadoEn = now()).
 * - Borra movimientos de stock previos (los kardex viejos quedan limpios).
 * - Crea 10 productos cubriendo distintas categorías, géneros y temporadas.
 * - Para cada variante: stock inicial vía ingreso_compra hace 6 meses,
 *   luego 2-4 egreso_venta distribuidos en los últimos 6 meses para que
 *   el kardex y el Motor Logístico tengan algo real que mostrar.
 * - NO toca clientes, ventas, compras, cupones ni nada más. Mínimo absoluto.
 *
 *   Uso: pnpm exec tsx scripts/seed-productos-10.ts [--code loremstore]
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

const TENANT_CODE = process.argv.includes('--code')
  ? process.argv[process.argv.indexOf('--code') + 1]!
  : 'loremstore';
const SCHEMA = `tenant_${TENANT_CODE.replace(/-/g, '_')}`;

const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('schema', SCHEMA);

// ─── Catálogo curado: 10 productos coherentes ──────────────────────────────

interface VarianteSeed {
  talla: string;
  color: string;
  colorHex: string;
  stockInicial: number;
  /** Cantidad total vendida en 6 meses (egresos distribuidos). */
  ventas6m: number;
}

interface ProductoSeed {
  codigo: string;
  sku: string;
  nombre: string;
  descripcion: string;
  categoria: string; // slug
  genero: 'mujer' | 'hombre' | 'unisex' | 'ninia' | 'ninio';
  temporada: 'verano' | 'invierno' | 'primavera' | 'otonio' | 'todo_el_anio';
  material: string;
  precioVenta: number;
  precioCompra: number;
  variantes: VarianteSeed[];
}

const PRODUCTOS: ProductoSeed[] = [
  {
    codigo: 'M-0001', sku: 'POL-NEG', nombre: 'Polo Básico Negro',
    descripcion: 'Polo de algodón pima peruano. Cuello rib y corte regular.',
    categoria: 'polos', genero: 'unisex', temporada: 'todo_el_anio',
    material: 'Algodón Pima', precioVenta: 39.90, precioCompra: 15.00,
    variantes: [
      { talla: 'S', color: 'Negro', colorHex: '#111111', stockInicial: 20, ventas6m: 14 },
      { talla: 'M', color: 'Negro', colorHex: '#111111', stockInicial: 25, ventas6m: 18 },
      { talla: 'L', color: 'Negro', colorHex: '#111111', stockInicial: 20, ventas6m: 12 },
    ],
  },
  {
    codigo: 'M-0002', sku: 'POL-BLA', nombre: 'Polo Básico Blanco',
    descripcion: 'Polo de algodón pima peruano. Cuello rib y corte regular.',
    categoria: 'polos', genero: 'unisex', temporada: 'todo_el_anio',
    material: 'Algodón Pima', precioVenta: 39.90, precioCompra: 15.00,
    variantes: [
      { talla: 'S', color: 'Blanco', colorHex: '#F5F5F5', stockInicial: 18, ventas6m: 10 },
      { talla: 'M', color: 'Blanco', colorHex: '#F5F5F5', stockInicial: 22, ventas6m: 16 },
      { talla: 'L', color: 'Blanco', colorHex: '#F5F5F5', stockInicial: 18, ventas6m: 9 },
    ],
  },
  {
    codigo: 'M-0003', sku: 'CAM-LIN', nombre: 'Camisa Lino Premium',
    descripcion: 'Camisa de lino 100% para clima cálido. Corte regular.',
    categoria: 'camisas', genero: 'hombre', temporada: 'verano',
    material: 'Lino 100%', precioVenta: 159.90, precioCompra: 65.00,
    variantes: [
      { talla: 'M', color: 'Beige', colorHex: '#D4C5A0', stockInicial: 10, ventas6m: 6 },
      { talla: 'L', color: 'Beige', colorHex: '#D4C5A0', stockInicial: 8, ventas6m: 5 },
      { talla: 'M', color: 'Azul Marino', colorHex: '#1B2A4E', stockInicial: 10, ventas6m: 7 },
    ],
  },
  {
    codigo: 'M-0004', sku: 'JEA-SLI', nombre: 'Jean Slim Fit',
    descripcion: 'Pantalón jean slim, denim de 12oz. Lavado medio.',
    categoria: 'pantalones', genero: 'hombre', temporada: 'todo_el_anio',
    material: 'Denim 12oz', precioVenta: 129.00, precioCompra: 50.00,
    variantes: [
      { talla: '30', color: 'Azul Medio', colorHex: '#3B5B7C', stockInicial: 8, ventas6m: 5 },
      { talla: '32', color: 'Azul Medio', colorHex: '#3B5B7C', stockInicial: 12, ventas6m: 9 },
      { talla: '34', color: 'Azul Medio', colorHex: '#3B5B7C', stockInicial: 10, ventas6m: 7 },
    ],
  },
  {
    codigo: 'M-0005', sku: 'VES-FLO', nombre: 'Vestido Floral Midi',
    descripcion: 'Vestido midi con estampa floral. Tela viscosa fluida.',
    categoria: 'vestidos', genero: 'mujer', temporada: 'verano',
    material: 'Viscosa', precioVenta: 169.00, precioCompra: 65.00,
    variantes: [
      { talla: 'S', color: 'Floral Rosa', colorHex: '#E8A5BD', stockInicial: 8, ventas6m: 6 },
      { talla: 'M', color: 'Floral Rosa', colorHex: '#E8A5BD', stockInicial: 10, ventas6m: 8 },
      { talla: 'L', color: 'Floral Rosa', colorHex: '#E8A5BD', stockInicial: 6, ventas6m: 3 },
    ],
  },
  {
    codigo: 'M-0006', sku: 'BLU-SED', nombre: 'Blusa Manga Larga Seda',
    descripcion: 'Blusa de seda con manga larga. Ideal para oficina.',
    categoria: 'blusas', genero: 'mujer', temporada: 'todo_el_anio',
    material: 'Seda', precioVenta: 119.00, precioCompra: 48.00,
    variantes: [
      { talla: 'S', color: 'Marfil', colorHex: '#F5EFDC', stockInicial: 9, ventas6m: 5 },
      { talla: 'M', color: 'Marfil', colorHex: '#F5EFDC', stockInicial: 12, ventas6m: 8 },
      { talla: 'M', color: 'Vino', colorHex: '#7B1F2A', stockInicial: 8, ventas6m: 6 },
    ],
  },
  {
    codigo: 'M-0007', sku: 'FAL-MID', nombre: 'Falda Midi Plisada',
    descripcion: 'Falda midi plisada, cintura alta con cierre invisible.',
    categoria: 'faldas', genero: 'mujer', temporada: 'primavera',
    material: 'Poliéster', precioVenta: 99.00, precioCompra: 38.00,
    variantes: [
      { talla: 'S', color: 'Negro', colorHex: '#111111', stockInicial: 7, ventas6m: 4 },
      { talla: 'M', color: 'Negro', colorHex: '#111111', stockInicial: 10, ventas6m: 7 },
      { talla: 'M', color: 'Mostaza', colorHex: '#D4A22B', stockInicial: 6, ventas6m: 2 },
    ],
  },
  {
    codigo: 'M-0008', sku: 'ABR-TRE', nombre: 'Abrigo Trench Coat',
    descripcion: 'Trench clásico de gabardina, doble botonadura.',
    categoria: 'abrigos', genero: 'mujer', temporada: 'invierno',
    material: 'Gabardina', precioVenta: 349.00, precioCompra: 140.00,
    variantes: [
      { talla: 'S', color: 'Beige', colorHex: '#C6A678', stockInicial: 5, ventas6m: 3 },
      { talla: 'M', color: 'Beige', colorHex: '#C6A678', stockInicial: 6, ventas6m: 4 },
    ],
  },
  {
    codigo: 'M-0009', sku: 'SHO-DEN', nombre: 'Short Denim Cintura Alta',
    descripcion: 'Short denim de cintura alta, lavado claro. Ajuste recto.',
    categoria: 'pantalones', genero: 'mujer', temporada: 'verano',
    material: 'Denim 10oz', precioVenta: 79.00, precioCompra: 30.00,
    variantes: [
      { talla: '26', color: 'Azul Claro', colorHex: '#8FB1D6', stockInicial: 10, ventas6m: 8 },
      { talla: '28', color: 'Azul Claro', colorHex: '#8FB1D6', stockInicial: 12, ventas6m: 10 },
      { talla: '30', color: 'Azul Claro', colorHex: '#8FB1D6', stockInicial: 9, ventas6m: 6 },
    ],
  },
  {
    codigo: 'M-0010', sku: 'CHA-CAR', nombre: 'Chaqueta Cardigan Tejida',
    descripcion: 'Cardigan tejido en mezcla de lana y acrílico. Cierre con botones.',
    categoria: 'abrigos', genero: 'mujer', temporada: 'otonio',
    material: 'Lana 60% / Acrílico 40%', precioVenta: 149.00, precioCompra: 58.00,
    variantes: [
      { talla: 'M', color: 'Camel', colorHex: '#B59261', stockInicial: 8, ventas6m: 4 },
      { talla: 'L', color: 'Camel', colorHex: '#B59261', stockInicial: 6, ventas6m: 3 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

const HOY = new Date();
const HACE_6M = new Date(HOY.getTime() - 180 * 24 * 60 * 60 * 1000);

function fechaInicial(): Date {
  return new Date(HACE_6M.getTime());
}

function distribuirVentas(total: number, desde: Date): Date[] {
  // Distribuye `total` egresos entre `desde` y hoy.
  // Más densidad en los últimos 60d para que insights se vean activos.
  if (total <= 0) return [];
  const fechas: Date[] = [];
  const ahora = Date.now();
  const inicio = desde.getTime();
  const ventana = ahora - inicio;
  // 60% de las ventas en últimos 60d, 40% repartidas en los 4 meses previos.
  const recientes = Math.round(total * 0.6);
  const viejas = total - recientes;
  const corte = ahora - 60 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < recientes; i++) {
    const off = (i + 0.5) / recientes * (ahora - corte);
    fechas.push(new Date(corte + off));
  }
  for (let i = 0; i < viejas; i++) {
    const off = (i + 0.5) / viejas * (corte - inicio);
    fechas.push(new Date(inicio + off));
  }
  return fechas.sort((a, b) => a.getTime() - b.getTime());
}

// ─── Main ─────────────────────────────────────────────────────────────────

(async () => {
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  console.log(`\n🧹 Limpiando productos previos de ${SCHEMA}...`);

  // Soft-delete productos previos (no romper FKs de ventas históricas).
  // Borrado físico de movimientos de stock para empezar kardex limpio.
  const variantesPrevias = await p.variante.findMany({ select: { id: true } });
  const varianteIdsPrevias = variantesPrevias.map(v => v.id);

  if (varianteIdsPrevias.length > 0) {
    const movs = await p.movimientoStock.deleteMany({
      where: { varianteId: { in: varianteIdsPrevias } },
    });
    console.log(`   ${movs.count} movimientos de stock borrados.`);

    await p.stockSucursal.deleteMany({
      where: { varianteId: { in: varianteIdsPrevias } },
    });

    await p.variante.updateMany({
      where: { id: { in: varianteIdsPrevias } },
      data: { eliminadoEn: new Date() },
    });
  }

  const productosPrevios = await p.producto.updateMany({
    where: { eliminadoEn: null },
    data: { eliminadoEn: new Date() },
  });
  console.log(`   ${productosPrevios.count} productos previos soft-eliminados.`);

  // Resolver sucursal principal (target de stock + movimientos).
  const sucursal = await p.sucursal.findFirst({
    where: { activa: true, esPrincipal: true },
    select: { id: true, nombre: true },
  }) ?? await p.sucursal.findFirst({ where: { activa: true }, select: { id: true, nombre: true } });

  if (!sucursal) {
    console.error('❌ No hay sucursales activas en el tenant. Aborto.');
    process.exit(1);
  }
  console.log(`   Sucursal target: ${sucursal.nombre} (${sucursal.id})`);

  // Resolver categorías por slug (asumimos que ya existen, las creó el bootstrap).
  const categorias = await p.categoria.findMany({
    where: { eliminadoEn: null },
    select: { id: true, slug: true, nombre: true },
  });
  const catPorSlug = new Map(categorias.map(c => [c.slug, c]));
  console.log(`   ${categorias.length} categorías disponibles: ${categorias.map(c => c.slug).join(', ')}`);

  console.log(`\n🌱 Sembrando 10 productos curados...\n`);

  let totalVariantes = 0;
  let totalMovimientos = 0;

  for (const prod of PRODUCTOS) {
    const categoria = catPorSlug.get(prod.categoria);
    if (!categoria) {
      console.warn(`   ⚠ Categoría "${prod.categoria}" no existe — saltando ${prod.nombre}`);
      continue;
    }

    const stockTotal = prod.variantes.reduce((s, v) => s + v.stockInicial, 0);
    const ventasTotal = prod.variantes.reduce((s, v) => s + v.ventas6m, 0);

    const productoCreado = await p.producto.create({
      data: {
        sku: prod.sku,
        codigo: prod.codigo,
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        categoriaId: categoria.id,
        genero: prod.genero,
        temporada: prod.temporada,
        material: prod.material,
        precioVenta: prod.precioVenta,
        precioCompra: prod.precioCompra,
        unidadMedidaCodigo: 'NIU',
        tipoAfectacionIgv: 'gravado_onerosa',
        creadoEn: HACE_6M,
        variantes: {
          create: prod.variantes.map((v, idx) => ({
            sku: `${prod.sku}-V${idx + 1}`,
            talla: v.talla,
            color: v.color,
            colorHex: v.colorHex,
            activo: true,
            stocks: {
              create: {
                sucursalId: sucursal.id,
                disponible: v.stockInicial - v.ventas6m,
                reservado: 0,
              },
            },
          })),
        },
      },
      include: { variantes: true },
    });

    // Kardex coherente por variante:
    //   1) ingreso_compra inicial (hace 6 meses) por stockInicial
    //   2) egreso_venta repartidos por ventas6m en los últimos 6 meses
    for (let i = 0; i < productoCreado.variantes.length; i++) {
      const varCreada = productoCreado.variantes[i]!;
      const varSeed = prod.variantes[i]!;

      // Movimiento 1: stock inicial vía ingreso_compra.
      let stockCorriente = 0;
      await p.movimientoStock.create({
        data: {
          varianteId: varCreada.id,
          sucursalId: sucursal.id,
          tipo: 'ingreso_compra',
          cantidad: varSeed.stockInicial,
          stockAntes: 0,
          stockDespues: varSeed.stockInicial,
          referenciaTipo: 'seed',
          notas: 'Stock inicial — seed curado',
          creadoEn: fechaInicial(),
        },
      });
      stockCorriente = varSeed.stockInicial;
      totalMovimientos++;

      // Movimientos 2-N: egresos distribuidos.
      const fechasVentas = distribuirVentas(varSeed.ventas6m, HACE_6M);
      for (const f of fechasVentas) {
        await p.movimientoStock.create({
          data: {
            varianteId: varCreada.id,
            sucursalId: sucursal.id,
            tipo: 'egreso_venta',
            cantidad: 1,
            stockAntes: stockCorriente,
            stockDespues: stockCorriente - 1,
            referenciaTipo: 'seed',
            notas: 'Venta histórica — seed curado',
            creadoEn: f,
          },
        });
        stockCorriente -= 1;
        totalMovimientos++;
      }
    }

    totalVariantes += prod.variantes.length;
    console.log(
      `   ✓ ${prod.codigo} ${prod.nombre.padEnd(28)} — ${prod.variantes.length} variantes · stock ${stockTotal - ventasTotal}/${stockTotal} · ${ventasTotal} ventas 6m`,
    );
  }

  console.log(`\n✅ Listo.`);
  console.log(`   Productos:    ${PRODUCTOS.length}`);
  console.log(`   Variantes:    ${totalVariantes}`);
  console.log(`   Movimientos:  ${totalMovimientos}`);
  console.log(`\n→ Abrí /productos y verás el kardex con datos en cada producto.\n`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
