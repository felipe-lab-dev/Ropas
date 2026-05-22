/**
 * Seed: 10 ventas distribuidas en los últimos 12 meses para poblar el sparkline
 * de C. Ventas y el Kardex. Cada venta toma 1-3 items aleatorios del catálogo.
 *
 *   Uso: pnpm exec tsx scripts/seed-ventas.ts [--code mi-tienda]
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
const CANTIDAD_VENTAS = 10;

function aleatorio<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function fechaAleatoriaEnUltimos12Meses(): Date {
  const ahora = Date.now();
  const hace12m = ahora - 365 * 24 * 3600 * 1000;
  const ts = hace12m + Math.random() * (ahora - hace12m);
  return new Date(ts);
}

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', SCHEMA);
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  console.log(`▶ Sembrando ${CANTIDAD_VENTAS} ventas en "${SCHEMA}"`);

  const sucursal = await p.sucursal.findFirst({ where: { esPrincipal: true, activa: true } });
  if (!sucursal) throw new Error('Sucursal principal no encontrada');

  const vendedor = await p.usuario.findFirst({ where: { activo: true, eliminadoEn: null } });
  if (!vendedor) throw new Error('Usuario vendedor no encontrado');

  const variantes = await p.variante.findMany({
    where: { eliminadoEn: null, producto: { eliminadoEn: null, activo: true } },
    include: {
      producto: { select: { nombre: true, precioVenta: true } },
      stocks: { where: { sucursalId: sucursal.id }, select: { disponible: true } },
    },
  });
  if (variantes.length === 0) throw new Error('No hay variantes en el catálogo. Corré seed-mujer primero.');

  // Filtrar variantes con stock (para no dejar negativo aunque el seed lo permitiría).
  const conStock = variantes.filter(v => (v.stocks[0]?.disponible ?? 0) > 0);
  if (conStock.length === 0) throw new Error('Ninguna variante tiene stock');

  const clientes = await p.cliente.findMany({ where: { eliminadoEn: null }, take: 5 });

  // Punto de partida del correlativo
  const ultimaVenta = await p.venta.findFirst({
    orderBy: { creadoEn: 'desc' },
    select: { numero: true },
  });
  let nro = ultimaVenta
    ? parseInt(ultimaVenta.numero.replace(/\D/g, ''), 10) + 1
    : 1;

  let creadas = 0;
  for (let i = 0; i < CANTIDAD_VENTAS; i++) {
    const numero = `V-${String(nro++).padStart(6, '0')}`;
    const fecha = fechaAleatoriaEnUltimos12Meses();
    const cantidadItems = 1 + Math.floor(Math.random() * 3); // 1..3
    const itemsSel: typeof conStock = [];
    while (itemsSel.length < cantidadItems) {
      const v = aleatorio(conStock);
      if (!itemsSel.includes(v)) itemsSel.push(v);
    }

    type Item = {
      varianteId: string; descripcion: string; cantidad: number;
      precioUnitario: number; subtotal: number;
    };
    const items: Item[] = itemsSel.map(v => {
      const stock = v.stocks[0]?.disponible ?? 1;
      const cant = 1 + Math.floor(Math.random() * Math.min(3, stock));
      const precio = Number(v.precioVenta ?? v.producto.precioVenta);
      return {
        varianteId: v.id,
        descripcion: `${v.producto.nombre} · ${v.talla}/${v.color}`,
        cantidad: cant,
        precioUnitario: precio,
        subtotal: precio * cant,
      };
    });
    const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
    const total = subtotal;
    const clienteId = Math.random() > 0.4 ? aleatorio(clientes)?.id : undefined;

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

      // Movimientos de stock por cada item
      for (const it of items) {
        const stock = await tx.stockSucursal.findUnique({
          where: { varianteId_sucursalId: { varianteId: it.varianteId, sucursalId: sucursal.id } },
        });
        const stockAntes = stock?.disponible ?? 0;
        const stockDespues = stockAntes - it.cantidad;
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

    creadas++;
    console.log(`  ✓ ${numero}  ${fecha.toISOString().slice(0, 10)}  ${items.length} items  S/${total.toFixed(2)}`);
  }

  console.log(`\n✅ ${creadas} ventas creadas`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
