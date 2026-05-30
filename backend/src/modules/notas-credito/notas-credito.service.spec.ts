/**
 * Tests del gate de sesión de caja en NotasCreditoService.
 * Se mockea Prisma ($transaction), Inventario, SerieCpeService y AppEventEmitter.
 */
import { NotasCreditoService } from './notas-credito.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';

const ctx = { codigo: 'mi-tienda', schema: 'tenant_mitienda' } as unknown as TenantContext;

function crearTx() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(0),
    sesionCaja: {
      // sucursalId debe coincidir con venta.sucursalId ('suc-1')
      findUnique: jest.fn().mockResolvedValue({ id: 'sess-1', estado: 'abierta', sucursalId: 'suc-1' }),
    },
    venta: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'v1',
        numero: 'V-000001',
        estado: 'pagada',
        sucursalId: 'suc-1',
        clienteId: null,
        esNotaDeVenta: true,
        items: [
          {
            id: 'vi1',
            varianteId: 'var-1',
            descripcion: 'Polo M/Azul',
            cantidad: 2,
            subtotal: 20,
          },
        ],
        notasCredito: [],
        documentoElectronico: null,
      }),
    },
    configuracionFacturacion: {
      findFirst: jest.fn().mockResolvedValue(null), // sin facturación electrónica
    },
    serieCpe: { findFirst: jest.fn(), update: jest.fn() },
    notaCredito: {
      findFirst: jest.fn().mockResolvedValue(null), // siguienteNumero
      create: jest.fn().mockResolvedValue({
        id: 'nc-1',
        numero: 'NC-000001',
        items: [],
      }),
    },
    cliente: { update: jest.fn().mockResolvedValue({}) },
    movimientoCaja: { create: jest.fn().mockResolvedValue({}) },
  };
}

function montar() {
  const tx = crearTx();
  const clienteDb = { $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)) };
  const prisma = { forTenant: jest.fn().mockReturnValue(clienteDb) };
  const inventario = { ajustarEnTx: jest.fn().mockResolvedValue({}) };
  const serieCpeService = { asignarProximoCorrelativoEnTenant: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const service = new NotasCreditoService(
    prisma as never,
    inventario as never,
    serieCpeService as never,
    eventEmitter as never,
  );
  return { service, tx, inventario, eventEmitter };
}

const dtoBase = {
  ventaId: 'v1',
  motivo: 'El cliente devolvió la prenda en mal estado',
  items: [{ ventaItemId: 'vi1', cantidad: 1 }],
  sesionCajaId: 'sess-1',
};

describe('NotasCreditoService · gate sesión de caja', () => {
  it('rechaza NC sin items (antes del gate)', async () => {
    const { service } = montar();
    await expect(
      service.crear({ ...dtoBase, items: [] } as never, ctx, 'u1'),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('rechaza NC sin motivo (antes del gate)', async () => {
    const { service } = montar();
    await expect(
      service.crear({ ...dtoBase, motivo: '  ' } as never, ctx, 'u1'),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('sin sesionCajaId → ErrorConflicto (sesión OBLIGATORIA)', async () => {
    const { service } = montar();
    const { sesionCajaId: _omit, ...sinSesion } = dtoBase;
    await expect(
      service.crear(sinSesion as never, ctx, 'u1'),
    ).rejects.toBeInstanceOf(ErrorConflicto);
  });

  it('sesión de caja inexistente → ErrorNoEncontrado', async () => {
    const { service, tx } = montar();
    tx.sesionCaja.findUnique.mockResolvedValue(null);
    await expect(
      service.crear(dtoBase as never, ctx, 'u1'),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('sesión de caja cerrada → ErrorConflicto', async () => {
    const { service, tx } = montar();
    tx.sesionCaja.findUnique.mockResolvedValue({ id: 'sess-1', estado: 'cerrada' });
    await expect(
      service.crear(dtoBase as never, ctx, 'u1'),
    ).rejects.toBeInstanceOf(ErrorConflicto);
  });

  it('sesión abierta → vincula sesionCajaId en la NC creada', async () => {
    const { service, tx } = montar();
    await service.crear(dtoBase as never, ctx, 'u1');
    const dataCreate = tx.notaCredito.create.mock.calls[0][0].data;
    expect(dataCreate.sesionCajaId).toBe('sess-1');
  });

  it('sesión de otra sucursal → ErrorConflicto', async () => {
    const { service, tx } = montar();
    tx.sesionCaja.findUnique.mockResolvedValue({ id: 'sess-1', estado: 'abierta', sucursalId: 'otra-sucursal' });
    await expect(
      service.crear(dtoBase as never, ctx, 'u1'),
    ).rejects.toBeInstanceOf(ErrorConflicto);
  });
});

describe('NotasCreditoService · devolución en efectivo (movimientoCaja)', () => {
  it('medioDevolucion efectivo → crea MovimientoCaja egreso devolucion_cliente por el total de la NC', async () => {
    const { service, tx } = montar();
    // El total de la NC se calcula sobre los items: precio=10 por unidad (subtotal 20 / 2), cantidad 1 → total 10
    await service.crear({ ...dtoBase, medioDevolucion: 'efectivo' } as never, ctx, 'u1');

    expect(tx.movimientoCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sesionId: 'sess-1',
          tipo: 'egreso',
          categoria: 'devolucion_cliente',
          medio: 'efectivo',
          monto: 10, // subtotal del item (20) / 2 unidades * 1 devuelta = 10
        }),
      }),
    );
  });

  it('medioDevolucion null → NO crea MovimientoCaja', async () => {
    const { service, tx } = montar();
    tx.movimientoCaja.create.mockClear();
    await service.crear({ ...dtoBase, medioDevolucion: null } as never, ctx, 'u1');
    expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
  });

  it('medioDevolucion tarjeta_debito → NO crea MovimientoCaja (solo efectivo genera movimiento)', async () => {
    const { service, tx } = montar();
    tx.movimientoCaja.create.mockClear();
    await service.crear({ ...dtoBase, medioDevolucion: 'tarjeta_debito' } as never, ctx, 'u1');
    expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
  });

  it('sin medioDevolucion (omitido) → NO crea MovimientoCaja', async () => {
    const { service, tx } = montar();
    tx.movimientoCaja.create.mockClear();
    await service.crear(dtoBase as never, ctx, 'u1');
    expect(tx.movimientoCaja.create).not.toHaveBeenCalled();
  });
});
