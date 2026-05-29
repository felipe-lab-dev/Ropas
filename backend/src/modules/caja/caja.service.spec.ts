/**
 * Tests del arqueo multi-moneda de CajaService. PEN vive en las columnas monto*
 * de la sesión; las monedas adicionales (USD) en `saldosMoneda` (JSON). Los
 * movimientos guardan su `moneda`. Prisma se mockea (caja no usa transacciones).
 */
import { CajaService } from './caja.service';
import { ErrorValidacion } from '../../core/errors/errores';
import { TenantContext } from '../../core/tenancy/tenant-context';

const ctx = { codigo: 'mi-tienda', schema: 'tenant_mitienda' } as unknown as TenantContext;

function montar() {
  const cliente = {
    sesionCaja: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 's1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    movimientoCaja: {
      create: jest.fn().mockResolvedValue({ id: 'm1' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const prisma = { forTenant: jest.fn().mockReturnValue(cliente) };
  const service = new CajaService(prisma as never);
  return { service, cliente };
}

describe('CajaService · abrir', () => {
  it('apertura con USD → saldosMoneda solo para la moneda extra', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findFirst.mockResolvedValue(null);

    await service.abrir(
      { sucursalId: 'su1', cajeroId: 'c1', montoApertura: 200, aperturasMoneda: [{ moneda: 'USD', monto: 50 }] },
      ctx,
    );

    const data = cliente.sesionCaja.create.mock.calls[0][0].data;
    expect(data.montoApertura).toBe(200);
    expect(data.saldosMoneda).toEqual([
      { moneda: 'USD', apertura: 50, cierre: null, esperado: null, diferencia: null },
    ]);
  });

  it('apertura solo PEN → saldosMoneda undefined (sin cambio de comportamiento)', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findFirst.mockResolvedValue(null);

    await service.abrir({ sucursalId: 'su1', cajeroId: 'c1', montoApertura: 200 }, ctx);

    expect(cliente.sesionCaja.create.mock.calls[0][0].data.saldosMoneda).toBeUndefined();
  });
});

describe('CajaService · crearMovimiento', () => {
  it('default PEN si no se especifica moneda', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findUnique.mockResolvedValue({ id: 's1', estado: 'abierta' });

    await service.crearMovimiento(
      's1',
      { tipo: 'ingreso', categoria: 'otro_ingreso', monto: 10, motivo: 'x' } as never,
      'u1',
      ctx,
    );

    expect(cliente.movimientoCaja.create.mock.calls[0][0].data.moneda).toBe('PEN');
  });

  it('guarda la moneda USD', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findUnique.mockResolvedValue({ id: 's1', estado: 'abierta' });

    await service.crearMovimiento(
      's1',
      { tipo: 'egreso', categoria: 'otro_egreso', moneda: 'USD', monto: 30, motivo: 'x' } as never,
      'u1',
      ctx,
    );

    expect(cliente.movimientoCaja.create.mock.calls[0][0].data.moneda).toBe('USD');
  });

  it('rechaza moneda fuera de la whitelist', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findUnique.mockResolvedValue({ id: 's1', estado: 'abierta' });

    await expect(
      service.crearMovimiento(
        's1',
        { tipo: 'ingreso', categoria: 'otro_ingreso', moneda: 'EUR', monto: 10, motivo: 'x' } as never,
        'u1',
        ctx,
      ),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });
});

describe('CajaService · cerrar', () => {
  it('solo PEN: arqueo en las columnas monto* (regresión)', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findUnique.mockResolvedValue({
      id: 's1',
      estado: 'abierta',
      montoApertura: 100,
      saldosMoneda: null,
      ventas: [],
      movimientos: [{ tipo: 'ingreso', medio: 'efectivo', moneda: 'PEN', monto: 50 }],
    });

    await service.cerrar('s1', { montoCierre: 150 }, ctx);

    const data = cliente.sesionCaja.update.mock.calls[0][0].data;
    expect(data.montoEsperado).toBe(150); // 100 + 50
    expect(data.diferencia).toBe(0);
    expect(data.estado).toBe('cerrada');
    expect(data.saldosMoneda).toBeUndefined();
  });

  it('PEN + USD: arquea cada moneda por separado y cuadra', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findUnique.mockResolvedValue({
      id: 's1',
      estado: 'abierta',
      montoApertura: 100,
      saldosMoneda: [{ moneda: 'USD', apertura: 50, cierre: null, esperado: null, diferencia: null }],
      ventas: [],
      movimientos: [
        { tipo: 'egreso', medio: 'efectivo', moneda: 'USD', monto: 30 },
        { tipo: 'ingreso', medio: 'efectivo', moneda: 'PEN', monto: 50 },
      ],
    });

    await service.cerrar('s1', { montoCierre: 150, cierresMoneda: [{ moneda: 'USD', monto: 20 }] }, ctx);

    const data = cliente.sesionCaja.update.mock.calls[0][0].data;
    expect(data.montoEsperado).toBe(150);
    expect(data.diferencia).toBe(0);
    expect(data.saldosMoneda).toEqual([
      { moneda: 'USD', apertura: 50, cierre: 20, esperado: 20, diferencia: 0 },
    ]);
    expect(data.estado).toBe('cerrada');
  });

  it('diferencia en USD → estado con_diferencia (aunque PEN cuadre)', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findUnique.mockResolvedValue({
      id: 's1',
      estado: 'abierta',
      montoApertura: 100,
      saldosMoneda: [{ moneda: 'USD', apertura: 50, cierre: null, esperado: null, diferencia: null }],
      ventas: [],
      movimientos: [{ tipo: 'egreso', medio: 'efectivo', moneda: 'USD', monto: 30 }],
    });

    await service.cerrar('s1', { montoCierre: 100, cierresMoneda: [{ moneda: 'USD', monto: 25 }] }, ctx);

    const data = cliente.sesionCaja.update.mock.calls[0][0].data;
    expect(data.diferencia).toBe(0); // PEN cuadra
    const usd = data.saldosMoneda[0];
    expect(usd.esperado).toBe(20); // 50 - 30
    expect(usd.diferencia).toBe(5); // 25 - 20
    expect(data.estado).toBe('con_diferencia');
  });
});

describe('CajaService · totalesSesion', () => {
  it('desglosa el efectivo esperado por moneda extra', async () => {
    const { service, cliente } = montar();
    cliente.sesionCaja.findUnique.mockResolvedValue({
      id: 's1',
      estado: 'abierta',
      montoApertura: 100,
      montoCierre: null,
      montoEsperado: null,
      diferencia: null,
      saldosMoneda: [{ moneda: 'USD', apertura: 50, cierre: null, esperado: null, diferencia: null }],
      ventas: [],
      movimientos: [{ tipo: 'egreso', medio: 'efectivo', moneda: 'USD', monto: 30 }],
    });

    const r = await service.totalesSesion('s1', ctx);

    expect(r.efectivoEsperado).toBe(100); // PEN no afectado por el egreso USD
    expect(r.porMoneda).toEqual([
      { moneda: 'USD', apertura: 50, ingresos: 0, egresos: 30, efectivoEsperado: 20 },
    ]);
  });
});
