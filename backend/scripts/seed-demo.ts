/**
 * Seed de demo: productos con variantes + stock + 10 clientes peruanos con
 * historial de ventas distribuido + clasificación RFM (AA · A · B · C · D).
 *
 * Asume que el tenant ya existe (corrió crear-tenant.ts) y tiene sucursal
 * principal, vendedor y categorías de productos.
 *
 *   Uso: pnpm exec tsx scripts/seed-demo.ts [--code mi-tienda]
 */
import { PrismaClient, ClasificacionAbc } from '@prisma/client';
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

type TipoDoc = 'dni' | 'carne_extranjeria' | 'ruc' | 'pasaporte' | 'otro';

interface PerfilCliente {
  tipoDocumento: TipoDoc;
  documento: string;
  nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
  ventas: number;          // cantidad de ventas a generar en 12 meses
  montoMin: number;        // S/. mínimo por venta
  montoMax: number;        // S/. máximo por venta
  diasAtrasUltimaCompra?: number; // si se setea, fuerza la última venta a hace N días
}

const CLIENTES: PerfilCliente[] = [
  // VIP esperado → AA
  { tipoDocumento: 'dni', documento: '70498300', nombre: 'María Fernanda Quispe Huamán', email: 'maria.quispe@gmail.com', telefono: '987 654 321', ciudad: 'Lima',
    ventas: 18, montoMin: 400, montoMax: 800 },
  // Top → A
  { tipoDocumento: 'dni', documento: '45678912', nombre: 'Carlos Alberto Ramírez Soto',  email: 'carlos.ramirez@outlook.com', telefono: '998 112 233', ciudad: 'Lima',
    ventas: 12, montoMin: 250, montoMax: 500 },
  { tipoDocumento: 'ruc', documento: '20512345678', nombre: 'Boutique Sol Andino SAC',   email: 'ventas@solandino.pe', telefono: '01 234-5678', ciudad: 'Arequipa',
    ventas: 10, montoMin: 200, montoMax: 450 },
  // Frecuentes → B
  { tipoDocumento: 'dni', documento: '46781234', nombre: 'Lucía Paola Torres Vega',      email: 'lucia.torres@hotmail.com', telefono: '976 543 210', ciudad: 'Trujillo',
    ventas: 7, montoMin: 150, montoMax: 300 },
  { tipoDocumento: 'dni', documento: '48127653', nombre: 'Jorge Luis Mendoza Cárdenas',  email: 'jmendoza@gmail.com',       telefono: '965 234 567', ciudad: 'Cusco',
    ventas: 6, montoMin: 120, montoMax: 280 },
  // Ocasionales → C
  { tipoDocumento: 'dni', documento: '47551122', nombre: 'Andrea Sofía Vargas Núñez',    email: 'andrea.vargas@gmail.com',  telefono: '991 887 766', ciudad: 'Lima',
    ventas: 3, montoMin: 80, montoMax: 200 },
  { tipoDocumento: 'dni', documento: '46998877', nombre: 'Diego Alonso Castro Bravo',    email: 'diego.castro@gmail.com',   telefono: '954 110 220', ciudad: 'Arequipa',
    ventas: 3, montoMin: 80, montoMax: 180 },
  // Lejano (1 sola venta hace 9 meses) → C/D
  { tipoDocumento: 'dni', documento: '44112233', nombre: 'Patricia Elena Salazar Ríos',  email: 'patricia.salazar@gmail.com', telefono: '942 333 444', ciudad: 'Trujillo',
    ventas: 1, montoMin: 90, montoMax: 90, diasAtrasUltimaCompra: 270 },
  // Sin compras → D
  { tipoDocumento: 'dni', documento: '49887766', nombre: 'Fernando Gabriel Ríos Cabrera', email: 'fer.rios@gmail.com',      telefono: '987 010 020', ciudad: 'Lima',
    ventas: 0, montoMin: 0, montoMax: 0 },
  { tipoDocumento: 'dni', documento: '46557788', nombre: 'Camila Andrea Flores Espinoza', email: 'camila.flores@gmail.com',  telefono: '999 010 020', ciudad: 'Cusco',
    ventas: 0, montoMin: 0, montoMax: 0 },
];

function aleatorio<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', SCHEMA);
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  console.log(`▶ Sembrando demo en schema "${SCHEMA}"`);

  const sucursal = await p.sucursal.findFirst({ where: { esPrincipal: true } });
  if (!sucursal) throw new Error('Sucursal Principal no encontrada — corré crear-tenant primero');

  const categorias = await p.categoria.findMany();
  const catMap = new Map(categorias.map(c => [c.slug, c.id]));

  // ─────────────────────────── PRODUCTOS ───────────────────────────
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

  // ─────────────────────────── CLIENTES ───────────────────────────
  type ClienteCreado = { id: string; perfil: PerfilCliente };
  const clientesCreados: ClienteCreado[] = [];
  let nuevosClientes = 0;
  for (const c of CLIENTES) {
    let cli = await p.cliente.findFirst({
      where: { tipoDocumento: c.tipoDocumento, documento: c.documento },
    });
    if (!cli) {
      cli = await p.cliente.create({
        data: {
          tipoDocumento: c.tipoDocumento,
          documento: c.documento,
          nombre: c.nombre,
          email: c.email,
          telefono: c.telefono,
          ciudad: c.ciudad,
        },
      });
      nuevosClientes++;
    }
    clientesCreados.push({ id: cli.id, perfil: c });
  }
  console.log(`Clientes: ${nuevosClientes} nuevos · ${clientesCreados.length} totales en el seed\n`);

  // ─────────────────── VENTAS POR PERFIL (idempotente) ───────────────────
  const vendedor = await p.usuario.findFirst({ where: { activo: true, eliminadoEn: null } });
  if (!vendedor) throw new Error('Usuario vendedor no encontrado — corré crear-tenant primero');

  const variantes = await p.variante.findMany({
    where: { eliminadoEn: null, producto: { eliminadoEn: null, activo: true } },
    include: {
      producto: { select: { nombre: true, precioVenta: true } },
      stocks: { where: { sucursalId: sucursal.id }, select: { disponible: true } },
    },
  });
  const conStock = variantes.filter(v => (v.stocks[0]?.disponible ?? 0) > 0);
  if (conStock.length === 0) {
    console.warn('  ⚠ No hay variantes con stock para generar ventas. Saltando ventas y clasificación.');
    await p.$disconnect();
    return;
  }

  // Punto de partida del correlativo — ordenamos por número, no por creadoEn,
  // porque las ventas semilla usan fechas históricas (creadoEn no monotónico).
  const ultimaVenta = await p.venta.findFirst({
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });
  let nro = ultimaVenta
    ? parseInt(ultimaVenta.numero.replace(/\D/g, ''), 10) + 1
    : 1;

  const ahora = Date.now();
  const hace12m = ahora - 365 * 24 * 3600 * 1000;
  let ventasCreadas = 0;
  let ventasSaltadas = 0;

  for (const { id: clienteId, perfil } of clientesCreados) {
    if (perfil.ventas === 0) continue;

    // Idempotencia: si el cliente ya tiene ventas en los últimos 12m, no generar más.
    const yaTiene = await p.venta.count({
      where: {
        clienteId,
        anuladaEn: null,
        creadoEn: { gte: new Date(hace12m) },
      },
    });
    if (yaTiene >= perfil.ventas) {
      ventasSaltadas += perfil.ventas;
      console.log(`  ⏭ ${perfil.nombre}: ya tiene ${yaTiene} ventas en 12m, no se generan más`);
      continue;
    }

    for (let v = 0; v < perfil.ventas; v++) {
      const numero = `V-${String(nro++).padStart(6, '0')}`;

      // Fecha: si es el último loop y hay diasAtrasUltimaCompra, forzar; sino aleatoria en 12m
      let fecha: Date;
      if (v === perfil.ventas - 1 && perfil.diasAtrasUltimaCompra) {
        fecha = new Date(ahora - perfil.diasAtrasUltimaCompra * 24 * 3600 * 1000);
      } else {
        fecha = new Date(hace12m + Math.random() * (ahora - hace12m));
      }

      const objetivo = perfil.montoMin + Math.random() * (perfil.montoMax - perfil.montoMin);

      // Armar 1-3 items que sumen cerca del objetivo
      type Item = {
        varianteId: string; descripcion: string; cantidad: number;
        precioUnitario: number; subtotal: number;
      };
      const items: Item[] = [];
      let acumulado = 0;
      const maxIntentos = 6;
      for (let i = 0; i < maxIntentos && acumulado < objetivo && items.length < 3; i++) {
        const cand = aleatorio(conStock);
        const stock = cand.stocks[0]?.disponible ?? 0;
        if (stock <= 0) continue;
        const precio = Number(cand.precioVenta ?? cand.producto.precioVenta);
        const faltante = objetivo - acumulado;
        const cantPosible = Math.max(1, Math.min(stock, Math.round(faltante / precio)));
        if (items.some(it => it.varianteId === cand.id)) continue;
        items.push({
          varianteId: cand.id,
          descripcion: `${cand.producto.nombre} · ${cand.talla}/${cand.color}`,
          cantidad: cantPosible,
          precioUnitario: precio,
          subtotal: precio * cantPosible,
        });
        acumulado += precio * cantPosible;
      }
      if (items.length === 0) {
        console.warn(`  ⚠ Sin items con stock para ${perfil.nombre}, saltando venta`);
        continue;
      }
      const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
      const total = subtotal;

      await p.$transaction(async tx => {
        const venta = await tx.venta.create({
          data: {
            numero,
            sucursalId: sucursal.id,
            vendedorId: vendedor.id,
            clienteId,
            estado: 'pagada',
            subtotal,
            descuento: 0,
            impuestos: 0,
            total,
            totalPagado: total,
            creadoEn: fecha,
            actualizadoEn: fecha,
            items: { create: items },
            pagos: {
              create: [{ medio: 'efectivo', monto: total, referencia: null }],
            },
          },
        });

        for (const it of items) {
          const stock = await tx.stockSucursal.findUnique({
            where: { varianteId_sucursalId: { varianteId: it.varianteId, sucursalId: sucursal.id } },
          });
          const stockAntes = stock?.disponible ?? 0;
          const stockDespues = Math.max(0, stockAntes - it.cantidad);
          await tx.stockSucursal.update({
            where: { varianteId_sucursalId: { varianteId: it.varianteId, sucursalId: sucursal.id } },
            data: { disponible: stockDespues },
          });
          await tx.movimientoStock.create({
            data: {
              varianteId: it.varianteId,
              sucursalId: sucursal.id,
              tipo: 'egreso_venta',
              cantidad: it.cantidad,
              stockAntes,
              stockDespues,
              referenciaTipo: 'venta',
              referenciaId: venta.id,
              notas: `Venta ${numero}`,
              usuarioId: vendedor.id,
              creadoEn: fecha,
            },
          });
        }
      });

      // Refrescar el stock en memoria de la variante usada (para no agotar en próximas iteraciones)
      for (const it of items) {
        const v = conStock.find(x => x.id === it.varianteId);
        if (v && v.stocks[0]) v.stocks[0].disponible = Math.max(0, v.stocks[0].disponible - it.cantidad);
      }
      ventasCreadas++;
    }
  }
  console.log(`Ventas: ${ventasCreadas} nuevas · ${ventasSaltadas} omitidas por idempotencia\n`);

  // ─────────────────── CLASIFICACIÓN RFM (motor inline) ───────────────────
  console.log('▶ Calculando clasificación RFM…');

  const PORCENTAJES: Record<ClasificacionAbc, number> = { AA: 0.06, A: 0.14, B: 0.20, C: 0.27, D: 0.33 };
  const PESOS = { recencia: 0.30, frecuencia: 0.30, monetario: 0.40 };
  const MESES = 12;
  const ejecutadoEn = new Date();
  const desde = new Date();
  desde.setMonth(desde.getMonth() - MESES);
  desde.setHours(0, 0, 0, 0);

  const todosClientes = await p.cliente.findMany({
    where: { eliminadoEn: null },
    select: { id: true, nombre: true },
  });
  const ventasAgg = await p.venta.findMany({
    where: {
      anuladaEn: null,
      clienteId: { not: null },
      creadoEn: { gte: desde },
    },
    select: { clienteId: true, total: true, creadoEn: true },
  });
  type Acc = { monto: number; cantidad: number; ultima?: Date };
  const porCliente = new Map<string, Acc>();
  for (const v of ventasAgg) {
    if (!v.clienteId) continue;
    const a = porCliente.get(v.clienteId) ?? { monto: 0, cantidad: 0 };
    a.monto += Number(v.total);
    a.cantidad += 1;
    if (!a.ultima || v.creadoEn > a.ultima) a.ultima = v.creadoEn;
    porCliente.set(v.clienteId, a);
  }
  const ventanaMs = MESES * 30 * 24 * 3600 * 1000;
  type Crudo = { id: string; nombre: string; monto: number; cantidad: number; r: number; f: number; m: number };
  const crudos: Crudo[] = todosClientes.map(c => {
    const a = porCliente.get(c.id);
    if (!a) return { id: c.id, nombre: c.nombre, monto: 0, cantidad: 0, r: 0, f: 0, m: 0 };
    const dias = a.ultima ? (Date.now() - a.ultima.getTime()) / ventanaMs : 1;
    const r = Math.max(0, 1 - dias);
    const f = Math.min(1, a.cantidad / MESES);
    return { id: c.id, nombre: c.nombre, monto: a.monto, cantidad: a.cantidad, r, f, m: a.monto };
  });
  const maxMonto = Math.max(1, ...crudos.map(c => c.monto));
  type Scored = Crudo & { score: number; mNorm: number };
  const scored: Scored[] = crudos.map(c => {
    const mNorm = c.monto / maxMonto;
    const score = c.r * PESOS.recencia + c.f * PESOS.frecuencia + mNorm * PESOS.monetario;
    return { ...c, mNorm, score };
  });
  const conVentas = scored.filter(s => s.cantidad > 0).sort((a, b) => b.score - a.score);
  const sinVentas = scored.filter(s => s.cantidad === 0);

  const total = todosClientes.length;
  const conVentasCount = conVentas.length;
  const cupos: Array<{ clase: ClasificacionAbc; cant: number }> = [];
  let asignados = 0;
  (['AA', 'A', 'B', 'C', 'D'] as ClasificacionAbc[]).forEach((clase, i, arr) => {
    let cant = Math.floor(total * (PORCENTAJES[clase] ?? 0));
    if (cant === 0 && clase !== 'D' && asignados < conVentasCount) cant = 1;
    if (i === arr.length - 1) cant = total - asignados;
    asignados += cant;
    cupos.push({ clase, cant });
  });

  const asignaciones = new Map<string, { clase: ClasificacionAbc; score: number; nombre: string }>();
  let cursor = 0;
  for (const { clase, cant } of cupos) {
    for (let i = 0; i < cant; i++) {
      const s = conVentas[cursor];
      if (!s) break;
      asignaciones.set(s.id, { clase, score: s.score, nombre: s.nombre });
      cursor++;
    }
  }
  for (const s of sinVentas) asignaciones.set(s.id, { clase: 'D', score: 0, nombre: s.nombre });
  for (const s of conVentas.slice(cursor)) asignaciones.set(s.id, { clase: 'D', score: s.score, nombre: s.nombre });

  await p.$transaction(
    Array.from(asignaciones, ([id, { clase, score }]) =>
      p.cliente.update({
        where: { id },
        data: { clasificacion: clase, clasificacionScore: score, clasificadoEn: ejecutadoEn },
      }),
    ),
  );

  const distribucion: Record<ClasificacionAbc, number> = { AA: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const { clase } of asignaciones.values()) distribucion[clase]++;

  console.log(`Distribución:  AA: ${distribucion.AA}  ·  A: ${distribucion.A}  ·  B: ${distribucion.B}  ·  C: ${distribucion.C}  ·  D: ${distribucion.D}`);
  console.log('\n  Detalle por cliente:');
  const ordenado = Array.from(asignaciones.entries())
    .map(([id, info]) => ({ id, ...info, score: info.score }))
    .sort((a, b) => b.score - a.score);
  for (const c of ordenado) {
    console.log(`    ${c.clase.padEnd(2)}  score=${c.score.toFixed(3)}  ${c.nombre}`);
  }

  console.log('\n✅ Seed demo completo');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
