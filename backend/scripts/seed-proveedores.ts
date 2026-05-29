/**
 * Seed de proveedores peruanos + una compra de ejemplo por cada uno.
 *
 * Por qué la compra: el kardex resuelve el "contraparte" del movimiento
 * únicamente cuando hay un MovimientoStock con referenciaTipo='Compra' que
 * apunte a una Compra real. Sin la compra el kardex no muestra al proveedor.
 *
 * Asume que el tenant ya existe (corrió crear-tenant) y tiene sucursal
 * principal, usuario admin y al menos algunas variantes con stock.
 *
 *   Uso: pnpm exec tsx scripts/seed-proveedores.ts [--code mi-tienda]
 *
 * Idempotente: si el RUC ya existe, salta. Si la compra de ejemplo
 * (serie+numero) ya existe para ese proveedor, salta.
 */
import {
  PrismaClient,
  Prisma,
  CondicionPago,
  TipoComprobanteCompra,
  TipoMovimientoStock,
} from '@prisma/client';
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

interface SeedProveedor {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  condicionPago: CondicionPago;
  diasCredito: number;
  cuentaBancaria: string;
  tags: string[];
  notas: string;
  unidadesPorVariante: number;
  costoUnitarioAprox: number;
  variantesEnCompra: number;
  tipoComprobante: TipoComprobanteCompra;
  serie: string;
}

const PROVEEDORES: SeedProveedor[] = [
  {
    ruc: '20512345671',
    razonSocial: 'TEXTILES ANDINOS S.A.C.',
    nombreComercial: 'Andina Textil',
    contacto: 'Rosa Mendoza',
    email: 'ventas@andinatextil.pe',
    telefono: '987111222',
    direccion: 'Av. Argentina 2450',
    ciudad: 'Lima',
    condicionPago: 'credito_30',
    diasCredito: 30,
    cuentaBancaria: 'BCP 194-1234567-0-12',
    tags: ['mayorista', 'algodon'],
    notas: 'Proveedor principal de algodón pima. Atiende de lunes a sábado.',
    unidadesPorVariante: 24,
    costoUnitarioAprox: 28,
    variantesEnCompra: 2,
    tipoComprobante: 'factura',
    serie: 'F001',
  },
  {
    ruc: '20512345672',
    razonSocial: 'CONFECCIONES GAMARRA E.I.R.L.',
    nombreComercial: 'Gamarra Express',
    contacto: 'Luis Alvarado',
    email: 'pedidos@gamarraexpress.pe',
    telefono: '998333444',
    direccion: 'Jr. Gamarra 1240, La Victoria',
    ciudad: 'Lima',
    condicionPago: 'credito_15',
    diasCredito: 15,
    cuentaBancaria: 'BBVA 0011-0234-12-3456789',
    tags: ['confeccion', 'rapido'],
    notas: 'Entrega en 48h dentro de Lima Metropolitana.',
    unidadesPorVariante: 18,
    costoUnitarioAprox: 22,
    variantesEnCompra: 2,
    tipoComprobante: 'factura',
    serie: 'F002',
  },
  {
    ruc: '20512345673',
    razonSocial: 'IMPORTADORA ASIA MODA S.A.C.',
    nombreComercial: 'Asia Moda',
    contacto: 'Wei Chen',
    email: 'importaciones@asiamoda.pe',
    telefono: '976555666',
    direccion: 'Av. Aviación 4521, San Borja',
    ciudad: 'Lima',
    condicionPago: 'credito_60',
    diasCredito: 60,
    cuentaBancaria: 'Interbank 898-3000123456',
    tags: ['importado', 'tendencias'],
    notas: 'Importaciones desde Guangzhou. Lead time 35 días.',
    unidadesPorVariante: 36,
    costoUnitarioAprox: 18,
    variantesEnCompra: 3,
    tipoComprobante: 'factura',
    serie: 'F003',
  },
  {
    ruc: '20512345674',
    razonSocial: 'DISTRIBUIDORA EL SUR S.R.L.',
    nombreComercial: 'El Sur',
    contacto: 'Marina Vargas',
    email: 'marina@elsur.pe',
    telefono: '965777888',
    direccion: 'Av. Ejército 1820',
    ciudad: 'Arequipa',
    condicionPago: 'contado',
    diasCredito: 0,
    cuentaBancaria: 'BCP 215-9876543-0-08',
    tags: ['regional', 'arequipa'],
    notas: 'Distribuidor regional sur. Pagos al contado con 3% descuento.',
    unidadesPorVariante: 12,
    costoUnitarioAprox: 32,
    variantesEnCompra: 2,
    tipoComprobante: 'factura',
    serie: 'F004',
  },
  {
    ruc: '20512345675',
    razonSocial: 'ACCESORIOS LIMA NORTE E.I.R.L.',
    nombreComercial: 'LimaNorte Acc.',
    contacto: 'Diego Romero',
    email: 'compras@limanorte.pe',
    telefono: '942999000',
    direccion: 'Av. Túpac Amaru 2390, Independencia',
    ciudad: 'Lima',
    condicionPago: 'credito_30',
    diasCredito: 30,
    cuentaBancaria: 'Scotiabank 000-1234567',
    tags: ['accesorios', 'mayorista'],
    notas: 'Especialista en accesorios complementarios (cinturones, bolsos, bisutería).',
    unidadesPorVariante: 20,
    costoUnitarioAprox: 12,
    variantesEnCompra: 2,
    tipoComprobante: 'boleta',
    serie: 'B001',
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('schema', SCHEMA);
  const p = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  console.log(`▶ Sembrando proveedores en schema "${SCHEMA}"`);

  const sucursal = await p.sucursal.findFirst({
    where: { esPrincipal: true, eliminadoEn: null },
  });
  if (!sucursal) throw new Error('Sucursal principal no encontrada — corré crear-tenant primero');

  const usuario = await p.usuario.findFirst({
    where: { activo: true, eliminadoEn: null },
    orderBy: { creadoEn: 'asc' },
  });
  if (!usuario) throw new Error('No hay usuario activo — corré crear-tenant primero');

  const variantes = await p.variante.findMany({
    where: { eliminadoEn: null, producto: { eliminadoEn: null } },
    include: {
      producto: { select: { nombre: true } },
      stocks: { where: { sucursalId: sucursal.id }, select: { disponible: true } },
    },
    orderBy: { creadoEn: 'asc' },
  });
  if (variantes.length === 0) {
    console.warn('⚠ No hay variantes en el tenant. Se crearán los proveedores pero NO las compras de ejemplo.');
  }

  const variantesYaUsadasEnSeed = new Set<string>();

  let creadosProv = 0;
  let saltadosProv = 0;
  let creadasCompras = 0;
  let saltadasCompras = 0;

  const anio = new Date().getFullYear();
  const prefijoNum = `C-${anio}-`;
  const ultima = await p.compra.findFirst({
    where: { numero: { startsWith: prefijoNum } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });
  let proximoCorrelativo = ultima ? parseInt(ultima.numero.slice(prefijoNum.length), 10) + 1 : 1;

  for (const def of PROVEEDORES) {
    const existente = await p.proveedor.findFirst({
      where: { tipoDocumento: 'ruc', documento: def.ruc },
    });

    let proveedorId: string;
    if (existente) {
      proveedorId = existente.id;
      saltadosProv++;
      console.log(`  ⏭ Proveedor ${def.ruc} (${def.razonSocial}) ya existe`);
    } else {
      const creado = await p.proveedor.create({
        data: {
          tipoDocumento: 'ruc',
          documento: def.ruc,
          razonSocial: def.razonSocial,
          nombreComercial: def.nombreComercial,
          contacto: def.contacto,
          email: def.email,
          telefono: def.telefono,
          direccion: def.direccion,
          ciudad: def.ciudad,
          condicionPago: def.condicionPago,
          diasCredito: def.diasCredito,
          cuentaBancaria: def.cuentaBancaria,
          tags: def.tags,
          notas: def.notas,
        },
        select: { id: true },
      });
      proveedorId = creado.id;
      creadosProv++;
      console.log(`  ✓ Proveedor creado: ${def.razonSocial} (${def.ruc})`);
    }

    if (variantes.length === 0) continue;

    const numeroComprobante = '0000' + String(creadosProv + saltadosProv).padStart(4, '0');
    const compraExistente = await p.compra.findFirst({
      where: {
        proveedorId,
        tipoComprobante: def.tipoComprobante,
        serie: def.serie,
        numeroComprobante,
      },
      select: { id: true },
    });
    if (compraExistente) {
      saltadasCompras++;
      console.log(`     ⏭ Compra ${def.serie}-${numeroComprobante} ya existe`);
      continue;
    }

    const candidatas = variantes.filter(v => !variantesYaUsadasEnSeed.has(v.id));
    if (candidatas.length < def.variantesEnCompra) {
      console.warn(`     ⚠ No hay suficientes variantes libres para ${def.razonSocial}, salto su compra`);
      continue;
    }
    const elegidas = candidatas.slice(0, def.variantesEnCompra);
    for (const v of elegidas) variantesYaUsadasEnSeed.add(v.id);

    const items = elegidas.map((v, idx) => {
      const jitter = 0.9 + ((idx * 7) % 21) / 100;
      const costoUnitario = round2(def.costoUnitarioAprox * jitter);
      const cantidad = def.unidadesPorVariante;
      const subtotal = round2(costoUnitario * cantidad);
      return {
        varianteId: v.id,
        descripcion: `${v.producto.nombre} · ${v.talla}/${v.color}`,
        cantidad,
        costoUnitario,
        descuento: 0,
        subtotal,
      };
    });

    const subtotalNeto = round2(items.reduce((s, i) => s + i.subtotal, 0));
    const igv = round2(subtotalNeto * 0.18);
    const total = round2(subtotalNeto + igv);

    const fechaEmision = new Date();
    fechaEmision.setDate(fechaEmision.getDate() - 7);
    const fechaRecepcion = new Date(fechaEmision);
    const esContado = def.condicionPago === 'contado';
    const fechaVencimiento = esContado
      ? null
      : new Date(fechaEmision.getTime() + def.diasCredito * 86_400_000);

    const numero = `${prefijoNum}${String(proximoCorrelativo++).padStart(5, '0')}`;

    await p.$transaction(async tx => {
      const compra = await tx.compra.create({
        data: {
          numero,
          proveedorId,
          sucursalId: sucursal.id,
          tipoComprobante: def.tipoComprobante,
          serie: def.serie,
          numeroComprobante,
          fechaEmision,
          fechaRecepcion,
          moneda: 'PEN',
          tipoCambio: 1,
          subtotal: subtotalNeto,
          igv,
          otrosImpuestos: 0,
          descuento: 0,
          total,
          estado: 'recibida',
          estadoPago: esContado ? 'pagada' : 'pendiente',
          totalPagado: esContado ? total : 0,
          condicionPago: def.condicionPago,
          fechaVencimiento,
          notas: 'Compra cargada por seed-proveedores',
          usuarioId: usuario.id,
          items: { create: items },
        },
      });

      for (const item of items) {
        const previo = await tx.stockSucursal.findUnique({
          where: {
            varianteId_sucursalId: {
              varianteId: item.varianteId,
              sucursalId: sucursal.id,
            },
          },
        });
        const stockAntes = previo?.disponible ?? 0;
        const stockDespues = stockAntes + item.cantidad;

        await tx.stockSucursal.upsert({
          where: {
            varianteId_sucursalId: {
              varianteId: item.varianteId,
              sucursalId: sucursal.id,
            },
          },
          create: {
            varianteId: item.varianteId,
            sucursalId: sucursal.id,
            disponible: stockDespues,
          },
          update: { disponible: stockDespues },
        });

        await tx.movimientoStock.create({
          data: {
            varianteId: item.varianteId,
            sucursalId: sucursal.id,
            tipo: TipoMovimientoStock.ingreso_compra,
            cantidad: item.cantidad,
            stockAntes,
            stockDespues,
            referenciaTipo: 'Compra',
            referenciaId: compra.id,
            notas: `Compra ${numero}`,
            usuarioId: usuario.id,
            creadoEn: fechaRecepcion,
          },
        });
      }

      if (esContado) {
        await tx.pagoCompra.create({
          data: {
            compraId: compra.id,
            medio: 'efectivo',
            monto: total,
            fechaPago: fechaRecepcion,
            usuarioId: usuario.id,
          },
        });
      }

      await tx.proveedor.update({
        where: { id: proveedorId },
        data: {
          totalComprado: { increment: new Prisma.Decimal(total) },
          deudaActual: esContado ? undefined : { increment: new Prisma.Decimal(total) },
          ultimaCompraEn: fechaRecepcion,
        },
      });
    });

    creadasCompras++;
    console.log(`     ✓ Compra ${numero} (${def.serie}-${numeroComprobante}) · S/ ${total.toFixed(2)}`);
  }

  console.log('');
  console.log(`Proveedores: ${creadosProv} nuevos · ${saltadosProv} omitidos por idempotencia`);
  console.log(`Compras de seed: ${creadasCompras} nuevas · ${saltadasCompras} omitidas`);
  console.log('');
  console.log('✅ Seed de proveedores completo');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
