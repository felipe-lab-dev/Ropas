/**
 * Seed: 10 productos de ropa de mujer con SKU auto, código tipo "M-0001" y stock.
 * Uso: pnpm exec tsx scripts/seed-mujer.ts [--code loremstore]
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

interface VarianteSeed { talla: string; color: string; hex: string; stock: number }
interface ProductoSeed {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  temporada: string;
  material: string;
  precioVenta: number;
  precioCompra: number;
  variantes: VarianteSeed[];
}

const PRODUCTOS: ProductoSeed[] = [
  {
    codigo: 'M-0001', nombre: 'Vestido Antonella', descripcion: 'Vestido midi corte A, manga corta.',
    categoria: 'vestidos', temporada: 'verano', material: 'Viscosa',
    precioVenta: 68.00, precioCompra: 45.00,
    variantes: [
      { talla: 'S', color: 'Rosa', hex: '#EC4899', stock: 6 },
      { talla: 'M', color: 'Rosa', hex: '#EC4899', stock: 8 },
      { talla: 'L', color: 'Rosa', hex: '#EC4899', stock: 5 },
    ],
  },
  {
    codigo: 'M-0002', nombre: 'Vestido Ary', descripcion: 'Vestido casual cuello redondo.',
    categoria: 'vestidos', temporada: 'verano', material: 'Algodón',
    precioVenta: 65.00, precioCompra: 35.00,
    variantes: [
      { talla: 'S', color: 'Blanco', hex: '#F8F8F8', stock: 10 },
      { talla: 'M', color: 'Blanco', hex: '#F8F8F8', stock: 12 },
      { talla: 'L', color: 'Negro', hex: '#111111', stock: 8 },
    ],
  },
  {
    codigo: 'M-0003', nombre: 'Vestido Tania', descripcion: 'Vestido floral con cinturón.',
    categoria: 'vestidos', temporada: 'primavera', material: 'Poliéster',
    precioVenta: 65.00, precioCompra: 35.00,
    variantes: [
      { talla: 'S', color: 'Floral Azul', hex: '#7B9FCB', stock: 4 },
      { talla: 'M', color: 'Floral Azul', hex: '#7B9FCB', stock: 6 },
      { talla: 'L', color: 'Floral Rosa', hex: '#E8A5BD', stock: 5 },
    ],
  },
  {
    codigo: 'M-0004', nombre: 'Vestido Angel', descripcion: 'Vestido fiesta tirantes finos.',
    categoria: 'vestidos', temporada: 'verano', material: 'Satén',
    precioVenta: 89.00, precioCompra: 45.00,
    variantes: [
      { talla: 'S', color: 'Negro', hex: '#111111', stock: 3 },
      { talla: 'M', color: 'Negro', hex: '#111111', stock: 5 },
      { talla: 'M', color: 'Rojo Vino', hex: '#7B1F2A', stock: 4 },
    ],
  },
  {
    codigo: 'M-0005', nombre: 'Blusa Camila', descripcion: 'Blusa manga 3/4 cuello en V.',
    categoria: 'camisas', temporada: 'todo_el_anio', material: 'Chiffon',
    precioVenta: 42.00, precioCompra: 22.00,
    variantes: [
      { talla: 'S', color: 'Blanco', hex: '#F8F8F8', stock: 12 },
      { talla: 'M', color: 'Blanco', hex: '#F8F8F8', stock: 15 },
      { talla: 'L', color: 'Beige', hex: '#D4C5A0', stock: 10 },
    ],
  },
  {
    codigo: 'M-0006', nombre: 'Polo Rojo', descripcion: 'Polo básico cuello camisero.',
    categoria: 'polos', temporada: 'todo_el_anio', material: 'Algodón Pima',
    precioVenta: 27.00, precioCompra: 18.00,
    variantes: [
      { talla: 'S', color: 'Rojo', hex: '#DC2626', stock: 20 },
      { talla: 'M', color: 'Rojo', hex: '#DC2626', stock: 25 },
      { talla: 'L', color: 'Rojo', hex: '#DC2626', stock: 15 },
    ],
  },
  {
    codigo: 'M-0007', nombre: 'Polo Verde', descripcion: 'Polo básico cuello camisero.',
    categoria: 'polos', temporada: 'todo_el_anio', material: 'Algodón Pima',
    precioVenta: 27.00, precioCompra: 15.00,
    variantes: [
      { talla: 'S', color: 'Verde', hex: '#16A34A', stock: 18 },
      { talla: 'M', color: 'Verde', hex: '#16A34A', stock: 22 },
    ],
  },
  {
    codigo: 'M-0008', nombre: 'Falda Mariana', descripcion: 'Falda midi plisada.',
    categoria: 'faldas', temporada: 'primavera', material: 'Poliéster',
    precioVenta: 55.00, precioCompra: 28.00,
    variantes: [
      { talla: 'S', color: 'Negro', hex: '#111111', stock: 8 },
      { talla: 'M', color: 'Negro', hex: '#111111', stock: 10 },
      { talla: 'M', color: 'Verde Oliva', hex: '#4A5D3E', stock: 6 },
    ],
  },
  {
    codigo: 'M-0009', nombre: 'Jean Sofía', descripcion: 'Jean tiro alto skinny.',
    categoria: 'pantalones', temporada: 'todo_el_anio', material: 'Denim',
    precioVenta: 89.00, precioCompra: 42.00,
    variantes: [
      { talla: '26', color: 'Azul Medio', hex: '#3B5B7C', stock: 7 },
      { talla: '28', color: 'Azul Medio', hex: '#3B5B7C', stock: 10 },
      { talla: '30', color: 'Azul Medio', hex: '#3B5B7C', stock: 8 },
      { talla: '28', color: 'Negro', hex: '#0A0A0A', stock: 9 },
    ],
  },
  {
    codigo: 'M-0010', nombre: 'Abrigo Valentina', descripcion: 'Abrigo paño largo con cinturón.',
    categoria: 'abrigos', temporada: 'invierno', material: 'Paño',
    precioVenta: 169.00, precioCompra: 85.00,
    variantes: [
      { talla: 'S', color: 'Camel', hex: '#C6A678', stock: 3 },
      { talla: 'M', color: 'Camel', hex: '#C6A678', stock: 4 },
      { talla: 'M', color: 'Negro', hex: '#111111', stock: 2 },
    ],
  },
];

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', SCHEMA);
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  console.log(`▶ Sembrando 10 productos de mujer en "${SCHEMA}"`);

  const sucursal = await p.sucursal.findFirst({ where: { esPrincipal: true } });
  if (!sucursal) throw new Error('Sucursal principal no encontrada — corré crear-tenant primero');

  const categorias = await p.categoria.findMany();
  const catMap = new Map(categorias.map(c => [c.slug, c.id]));

  let ultimoSkuN = 0;
  const ultimo = await p.producto.findFirst({
    where: { sku: { startsWith: 'P-' } },
    orderBy: { sku: 'desc' },
    select: { sku: true },
  });
  if (ultimo) {
    const m = ultimo.sku.match(/^P-(\d+)$/);
    if (m && m[1]) ultimoSkuN = parseInt(m[1], 10);
  }

  let creados = 0;
  for (const def of PRODUCTOS) {
    const catId = catMap.get(def.categoria);
    if (!catId) {
      console.warn(`  ⚠ Categoría "${def.categoria}" no existe, saltando ${def.codigo}`);
      continue;
    }

    const existe = await p.producto.findFirst({ where: { codigo: def.codigo } });
    if (existe) { console.log(`  ⏭ ${def.codigo} ya existe`); continue; }

    ultimoSkuN += 1;
    const sku = `P-${String(ultimoSkuN).padStart(5, '0')}`;

    await p.$transaction(async tx => {
      const prod = await tx.producto.create({
        data: {
          sku,
          codigo: def.codigo,
          nombre: def.nombre,
          descripcion: def.descripcion,
          categoriaId: catId,
          genero: 'mujer',
          temporada: def.temporada as any,
          material: def.material,
          precioVenta: def.precioVenta,
          precioCompra: def.precioCompra,
        },
      });

      for (const [i, v] of def.variantes.entries()) {
        const variante = await tx.variante.create({
          data: {
            productoId: prod.id,
            sku: `${sku}-${String(i + 1).padStart(2, '0')}`,
            talla: v.talla,
            color: v.color,
            colorHex: v.hex,
          },
        });
        await tx.stockSucursal.create({
          data: {
            varianteId: variante.id,
            sucursalId: sucursal.id,
            disponible: v.stock,
            stockMinimo: 2,
          },
        });
      }
    });

    creados++;
    console.log(`  ✓ ${def.codigo}  ${sku}  ${def.nombre}  (${def.variantes.length} variantes)`);
  }

  console.log(`\n✅ ${creados} productos creados`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
