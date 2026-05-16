/**
 * Seed de demo: productos con variantes + stock + clientes + algunas ventas
 * Asume que el tenant `mi-tienda` ya existe y está sembrado.
 *
 * Uso: pnpm exec tsx scripts/seed-demo.ts [--code mi-tienda]
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
  : 'mi-tienda';

const SCHEMA = `tenant_${TENANT_CODE.replace(/-/g, '_')}`;

const PRODUCTOS = [
  {
    sku: 'CAM-001', nombre: 'Camisa Lino Premium',
    descripcion: 'Camisa de lino 100% para clima cálido. Corte regular.',
    categoria: 'camisas', genero: 'hombre', temporada: 'verano',
    material: 'Lino 100%', cuidado: 'Lavar en frío. Planchar a baja temperatura.',
    precioVenta: 189.90, precioCompra: 75.00,
    variantes: [
      { talla: 'P', color: 'Branco', colorHex: '#FFFFFF', stock: 8 },
      { talla: 'M', color: 'Branco', colorHex: '#FFFFFF', stock: 12 },
      { talla: 'G', color: 'Branco', colorHex: '#FFFFFF', stock: 10 },
      { talla: 'M', color: 'Azul Marinho', colorHex: '#1B2A4E', stock: 6 },
      { talla: 'G', color: 'Azul Marinho', colorHex: '#1B2A4E', stock: 4 },
    ],
  },
  {
    sku: 'CAM-002', nombre: 'Camisa Social Slim',
    descripcion: 'Camisa social slim fit, algodão egípcio.',
    categoria: 'camisas', genero: 'hombre', temporada: 'todo_el_anio',
    material: 'Algodón Egipcio', cuidado: 'Lavar máquina ciclo suave.',
    precioVenta: 249.00, precioCompra: 95.00,
    variantes: [
      { talla: 'M', color: 'Branco', colorHex: '#FFFFFF', stock: 15 },
      { talla: 'G', color: 'Branco', colorHex: '#FFFFFF', stock: 12 },
      { talla: 'M', color: 'Celeste', colorHex: '#A7D8F5', stock: 7 },
      { talla: 'G', color: 'Celeste', colorHex: '#A7D8F5', stock: 5 },
    ],
  },
  {
    sku: 'PNT-001', nombre: 'Calça Jeans Slim',
    descripcion: 'Calça jeans slim, lavagem média.',
    categoria: 'pantalones', genero: 'hombre', temporada: 'todo_el_anio',
    material: 'Denim 12oz', cuidado: 'Lavar do avesso.',
    precioVenta: 299.90, precioCompra: 110.00,
    variantes: [
      { talla: '38', color: 'Azul Médio', colorHex: '#3B5B7C', stock: 6 },
      { talla: '40', color: 'Azul Médio', colorHex: '#3B5B7C', stock: 9 },
      { talla: '42', color: 'Azul Médio', colorHex: '#3B5B7C', stock: 7 },
      { talla: '40', color: 'Preto', colorHex: '#0A0A0A', stock: 8 },
      { talla: '42', color: 'Preto', colorHex: '#0A0A0A', stock: 5 },
    ],
  },
  {
    sku: 'VST-001', nombre: 'Vestido Floral Midi',
    descripcion: 'Vestido midi con estampa floral, alças finas.',
    categoria: 'vestidos', genero: 'mujer', temporada: 'verano',
    material: 'Viscose', cuidado: 'Lavar a mano, sombra.',
    precioVenta: 219.00, precioCompra: 85.00,
    variantes: [
      { talla: 'P', color: 'Floral Rosa', colorHex: '#E8A5BD', stock: 5 },
      { talla: 'M', color: 'Floral Rosa', colorHex: '#E8A5BD', stock: 8 },
      { talla: 'G', color: 'Floral Rosa', colorHex: '#E8A5BD', stock: 4 },
      { talla: 'P', color: 'Floral Azul', colorHex: '#7B9FCB', stock: 3 },
      { talla: 'M', color: 'Floral Azul', colorHex: '#7B9FCB', stock: 6 },
    ],
  },
  {
    sku: 'POL-001', nombre: 'Polo Básica Algodão',
    descripcion: 'Polo básica de algodão peruano.',
    categoria: 'polos', genero: 'unisex', temporada: 'todo_el_anio',
    material: 'Algodão Pima', cuidado: 'Lavagem normal.',
    precioVenta: 89.90, precioCompra: 32.00,
    variantes: [
      { talla: 'P', color: 'Preto', colorHex: '#0A0A0A', stock: 20 },
      { talla: 'M', color: 'Preto', colorHex: '#0A0A0A', stock: 25 },
      { talla: 'G', color: 'Preto', colorHex: '#0A0A0A', stock: 18 },
      { talla: 'M', color: 'Vinho', colorHex: '#7B1F2A', stock: 12 },
      { talla: 'G', color: 'Vinho', colorHex: '#7B1F2A', stock: 8 },
      { talla: 'M', color: 'Verde Militar', colorHex: '#4A5D3E', stock: 0 },
    ],
  },
  {
    sku: 'ABR-001', nombre: 'Casaco Trench Coat',
    descripcion: 'Trench coat clássico de gabardine.',
    categoria: 'abrigos', genero: 'mujer', temporada: 'invierno',
    material: 'Gabardine', cuidado: 'Lavagem a seco.',
    precioVenta: 549.00, precioCompra: 220.00,
    variantes: [
      { talla: 'P', color: 'Bege', colorHex: '#C6A678', stock: 3 },
      { talla: 'M', color: 'Bege', colorHex: '#C6A678', stock: 4 },
      { talla: 'G', color: 'Bege', colorHex: '#C6A678', stock: 2 },
    ],
  },
];

const CLIENTES = [
  { tipoDocumento: 'cpf', documento: '12345678901', nombre: 'Maria Silva Santos', email: 'maria@email.com', telefono: '11 98765-4321', ciudad: 'São Paulo' },
  { tipoDocumento: 'cpf', documento: '98765432109', nombre: 'João Pedro Oliveira', email: 'joao@email.com', telefono: '11 91234-5678', ciudad: 'São Paulo' },
  { tipoDocumento: 'cpf', documento: '45678901234', nombre: 'Ana Carolina Lima', email: 'ana@email.com', telefono: '21 99876-5432', ciudad: 'Rio de Janeiro' },
  { tipoDocumento: 'cpf', documento: '78901234567', nombre: 'Carlos Eduardo Souza', email: 'carlos@email.com', telefono: '11 95555-1212', ciudad: 'São Paulo' },
];

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', SCHEMA);
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  console.log(`▶ Sembrando demo en schema "${SCHEMA}"`);

  const sucursal = await p.sucursal.findFirst({ where: { esPrincipal: true } });
  if (!sucursal) throw new Error('Sucursal Principal no encontrada — corré crear-tenant primero');

  const categorias = await p.categoria.findMany();
  const catMap = new Map(categorias.map(c => [c.slug, c.id]));

  let creados = 0;
  for (const def of PRODUCTOS) {
    const catId = catMap.get(def.categoria);
    if (!catId) {
      console.warn(`  ⚠ Categoría ${def.categoria} no existe, saltando ${def.sku}`);
      continue;
    }

    const existe = await p.producto.findFirst({ where: { sku: def.sku } });
    if (existe) { console.log(`  ⏭ ${def.sku} ya existe`); continue; }

    await p.$transaction(async tx => {
      const prod = await tx.producto.create({
        data: {
          sku: def.sku,
          nombre: def.nombre,
          descripcion: def.descripcion,
          categoriaId: catId,
          genero: def.genero as any,
          temporada: def.temporada as any,
          material: def.material,
          cuidado: def.cuidado,
          precioVenta: def.precioVenta,
          precioCompra: def.precioCompra,
        },
      });

      for (const [i, v] of def.variantes.entries()) {
        const variante = await tx.variante.create({
          data: {
            productoId: prod.id,
            sku: `${def.sku}-${String(i + 1).padStart(2, '0')}`,
            talla: v.talla,
            color: v.color,
            colorHex: v.colorHex,
            codigoBarras: `789${Math.floor(Math.random() * 1e10).toString().padStart(10, '0')}`,
          },
        });
        await tx.stockSucursal.create({
          data: {
            varianteId: variante.id,
            sucursalId: sucursal.id,
            disponible: v.stock,
            stockMinimo: 3,
          },
        });
      }
    });

    creados++;
    console.log(`  ✓ ${def.sku} — ${def.nombre} (${def.variantes.length} variantes)`);
  }
  console.log(`Productos: ${creados} nuevos\n`);

  let cli = 0;
  for (const c of CLIENTES) {
    const exists = await p.cliente.findFirst({ where: { tipoDocumento: c.tipoDocumento as any, documento: c.documento } });
    if (exists) continue;
    await p.cliente.create({ data: c as any });
    cli++;
  }
  console.log(`Clientes: ${cli} nuevos\n`);

  console.log('✅ Seed demo completo');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
