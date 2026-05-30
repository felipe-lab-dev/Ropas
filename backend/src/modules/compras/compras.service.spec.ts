/**
 * Tests del flujo de dinero de ComprasService, con foco en compras en USD:
 * el costo de inventario, el asiento contable y la deuda del proveedor SIEMPRE
 * se normalizan a PEN con el tipo de cambio; la Compra guarda los montos en su
 * moneda original. Prisma ($transaction) e Inventario/Asientos se mockean.
 */
import { ComprasService } from './compras.service';
import { ErrorValidacion } from '../../core/errors/errores';
import { TenantContext } from '../../core/tenancy/tenant-context';

const ctx = { codigo: 'mi-tienda', schema: 'tenant_mitienda' } as unknown as TenantContext;

function crearTx() {
  return {
    variante: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'v1', producto: { nombre: 'Polo' }, talla: 'M', color: 'Rojo' },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'v1',
        productoId: 'p1',
        producto: { precioCompra: null },
        stocks: [{ disponible: 5 }],
      }),
    },
    proveedor: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'prov1',
        condicionPago: 'contado',
        diasCredito: 30,
        tipoDocumento: 'ruc',
        documento: '20123456789',
        razonSocial: 'Distribuidora SAC',
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    compra: {
      create: jest.fn().mockResolvedValue({ id: 'c1', items: [], proveedor: {} }),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ id: 'c1' }),
      findFirst: jest.fn().mockResolvedValue(null), // siguienteNumero
    },
    pagoCompra: { create: jest.fn().mockResolvedValue({ id: 'pago1' }) },
    producto: { update: jest.fn().mockResolvedValue({}) },
    movimientoCaja: { create: jest.fn().mockResolvedValue({}) },
    asientoContable: { findMany: jest.fn().mockResolvedValue([]) },
    sucursal: {
      findFirst: jest.fn().mockResolvedValue({ id: 'suc-principal' }),
    },
  };
}

function montar() {
  const tx = crearTx();
  const cliente = { $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)) };
  const prisma = { forTenant: jest.fn().mockReturnValue(cliente) };
  const inventario = { ajustarEnTx: jest.fn().mockResolvedValue({}) };
  const asientos = {
    generarPorCompra: jest.fn().mockResolvedValue({}),
    generarPorPagoCompra: jest.fn().mockResolvedValue({}),
    reversar: jest.fn().mockResolvedValue({}),
  };
  const service = new ComprasService(prisma as never, inventario as never, asientos as never);
  return { service, tx, inventario, asientos };
}

const dtoBase = {
  proveedorId: 'prov1',
  sucursalId: 'suc1',
  tipoComprobante: 'factura' as const,
  serie: 'F001',
  numeroComprobante: '123',
  fechaEmision: '2026-05-29',
  items: [{ varianteId: 'v1', cantidad: 5, costoUnitario: 10, descuento: 0 }],
  confirmar: true,
};

describe('ComprasService · crear (moneda)', () => {
  it('compra USD: costo de inventario, asiento y proveedor en PEN; Compra en USD original', async () => {
    const { service, tx, asientos } = montar();

    await service.crear({ ...dtoBase, moneda: 'USD', tipoCambio: 3.75 } as never, ctx, 'u1');

    // Compra guardada en moneda original
    const dataCompra = tx.compra.create.mock.calls[0][0].data;
    expect(dataCompra.moneda).toBe('USD');
    expect(dataCompra.tipoCambio).toBe(3.75);
    expect(dataCompra.subtotal).toBe(50); // 10*5
    expect(dataCompra.total).toBe(59); // 50 + 18% = 59 (USD)

    // Costo del producto convertido a PEN (10 USD * 3.75 = 37.5), NO 10
    expect(tx.producto.update.mock.calls[0][0].data.precioCompra).toBe(37.5);

    // Asiento en PEN + metadata de moneda/TC
    const asiento = asientos.generarPorCompra.mock.calls[0][1];
    expect(asiento.subtotal).toBe(187.5); // 50 * 3.75
    expect(asiento.total).toBe(221.25); // 59 * 3.75
    expect(asiento.moneda).toBe('USD');
    expect(asiento.tipoCambio).toBe(3.75);

    // Proveedor: acumulador en PEN
    const prov = tx.proveedor.update.mock.calls[0][0].data;
    expect(prov.totalComprado.increment).toBe(221.25); // 59 * 3.75
  });

  it('compra PEN (default): comportamiento sin conversión (regresión)', async () => {
    const { service, tx, asientos } = montar();

    await service.crear({ ...dtoBase } as never, ctx, 'u1'); // sin moneda

    const dataCompra = tx.compra.create.mock.calls[0][0].data;
    expect(dataCompra.moneda).toBe('PEN');
    expect(dataCompra.tipoCambio).toBe(1);
    expect(tx.producto.update.mock.calls[0][0].data.precioCompra).toBe(10); // sin *tc
    expect(asientos.generarPorCompra.mock.calls[0][1].total).toBe(59);
    expect(tx.proveedor.update.mock.calls[0][0].data.totalComprado.increment).toBe(59);
  });

  it('PEN ignora el tipoCambio recibido y lo fuerza a 1', async () => {
    const { service, tx } = montar();

    await service.crear({ ...dtoBase, moneda: 'PEN', tipoCambio: 99 } as never, ctx, 'u1');

    expect(tx.compra.create.mock.calls[0][0].data.tipoCambio).toBe(1);
    expect(tx.producto.update.mock.calls[0][0].data.precioCompra).toBe(10); // no *99
  });

  it('USD sin tipoCambio → ErrorValidacion y no crea la compra', async () => {
    const { service, tx } = montar();

    await expect(
      service.crear({ ...dtoBase, moneda: 'USD' } as never, ctx, 'u1'),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(tx.compra.create).not.toHaveBeenCalled();
  });
});

describe('ComprasService · crear (sucursal 1-tenant-1-sucursal)', () => {
  it('sin sucursalId: resuelve la sucursal principal y la usa en compra + stock', async () => {
    const { service, tx, inventario } = montar();
    const { sucursalId: _omit, ...sinSucursal } = dtoBase;

    await service.crear(sinSucursal as never, ctx, 'u1');

    expect(tx.sucursal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { esPrincipal: true, eliminadoEn: null } }),
    );
    expect(tx.compra.create.mock.calls[0][0].data.sucursalId).toBe('suc-principal');
    expect(inventario.ajustarEnTx.mock.calls[0][1].sucursalId).toBe('suc-principal');
  });

  it('sin sucursal principal configurada → ErrorValidacion y no crea la compra', async () => {
    const { service, tx } = montar();
    tx.sucursal.findFirst.mockResolvedValue(null);
    const { sucursalId: _omit, ...sinSucursal } = dtoBase;

    await expect(
      service.crear(sinSucursal as never, ctx, 'u1'),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(tx.compra.create).not.toHaveBeenCalled();
  });
});

describe('ComprasService · registrarPago (moneda)', () => {
  it('pago de compra USD: PagoCompra en USD, deuda y asiento en PEN', async () => {
    const { service, tx, asientos } = montar();
    tx.compra.findFirst.mockResolvedValue({
      id: 'c1',
      numero: 'C-2026-00001',
      estado: 'recibida',
      moneda: 'USD',
      tipoCambio: 3.75,
      total: 100,
      totalPagado: 0,
      proveedorId: 'prov1',
      proveedor: { tipoDocumento: 'ruc', documento: '20123456789', razonSocial: 'X' },
    });

    await service.registrarPago(
      'c1',
      { medio: 'efectivo', monto: 50, sesionCajaId: 'ses1' } as never,
      ctx,
      'u1',
    );

    // Pago en moneda original
    expect(tx.pagoCompra.create.mock.calls[0][0].data.monto).toBe(50);
    // Movimiento de caja en moneda ORIGINAL (la caja maneja ambas monedas)
    const mov = tx.movimientoCaja.create.mock.calls[0][0].data;
    expect(mov.moneda).toBe('USD');
    expect(mov.monto).toBe(50);
    // Deuda del proveedor en PEN: 50 * 3.75 = 187.5
    expect(tx.proveedor.update.mock.calls[0][0].data.deudaActual.decrement).toBe(187.5);
    // Asiento del pago en PEN
    const asiento = asientos.generarPorPagoCompra.mock.calls[0][1];
    expect(asiento.monto).toBe(187.5);
    expect(asiento.tipoCambio).toBe(3.75);
  });
});
