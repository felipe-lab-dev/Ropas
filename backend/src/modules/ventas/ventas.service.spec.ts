import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { VentasService } from './ventas.service';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { InventarioService } from '../inventario/inventario.service';
import { MotorCuponesService } from '../cupones/motor-cupones.service';
import { SerieCpeService } from '../facturacion-electronica/series-cpe/series-cpe.service';
import { ConfiguracionFacturacionService } from '../facturacion-electronica/configuracion/configuracion-facturacion.service';
import { AppEventEmitter } from '../../core/events/app-event-emitter';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function crearTxMock() {
  const variante: Mocked<{ findMany: unknown; findUnique: unknown }> = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  const sucursal: Mocked<{ findFirst: unknown }> = { findFirst: jest.fn() };
  const clienteRepo: Mocked<{ findFirst: unknown; update: unknown }> = {
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const sesionCaja: Mocked<{ findUnique: unknown }> = { findUnique: jest.fn() };
  const venta: Mocked<{
    create: unknown;
    findFirst: unknown;
    findUnique: unknown;
    findMany: unknown;
    count: unknown;
    update: unknown;
  }> = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };
  const cupon: Mocked<{ findFirst: unknown; findUnique: unknown; update: unknown }> = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const cuponUso: Mocked<{ count: unknown; create: unknown; delete: unknown }> = {
    count: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const stockSucursal = { findUnique: jest.fn(), upsert: jest.fn() };
  const movimientoStock = { create: jest.fn() };
  // Snapshot de costo: crear() consulta el último costo de compra para variantes
  // sin precioCompra; listar() consulta los ítems para el margen por página.
  const compraItem: Mocked<{ findMany: unknown }> = { findMany: jest.fn().mockResolvedValue([]) };
  const ventaItem: Mocked<{ findMany: unknown }> = { findMany: jest.fn().mockResolvedValue([]) };
  const $executeRaw = jest.fn();

  return {
    variante,
    sucursal,
    cliente: clienteRepo,
    sesionCaja,
    venta,
    cupon,
    cuponUso,
    stockSucursal,
    movimientoStock,
    compraItem,
    ventaItem,
    $executeRaw,
  };
}

const ctx = {
  codigo: 'mi-tienda',
  schema: 'tenant_mitienda',
} as unknown as TenantContext;

describe('VentasService', () => {
  let service: VentasService;
  let prisma: { forTenant: jest.Mock };
  let tx: ReturnType<typeof crearTxMock>;
  let inventario: { ajustarEnTx: jest.Mock };
  let motorCupones: { evaluar: jest.Mock };
  let serieCpe: { asignarProximoCorrelativoEnTenant: jest.Mock };
  let configFacturacion: { estaConfigurada: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    tx = crearTxMock();
    inventario = { ajustarEnTx: jest.fn().mockResolvedValue({ stockAntes: 10, stockDespues: 8 }) };
    motorCupones = {
      evaluar: jest.fn().mockReturnValue({ valido: true, descuento: 0, mensaje: 'ok' }),
    };
    serieCpe = {
      asignarProximoCorrelativoEnTenant: jest.fn().mockResolvedValue({
        serieCpeId: 'serie-1',
        serie: 'B001',
        correlativo: '00000001',
      }),
    };
    // Por defecto el tenant NO tiene facturación configurada → el guard de
    // identificación de boletas queda inactivo en los tests existentes.
    configFacturacion = { estaConfigurada: jest.fn().mockResolvedValue(false) };
    eventEmitter = { emit: jest.fn() };

    const cliente = {
      ...tx,
      $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    prisma = { forTenant: jest.fn().mockReturnValue(cliente) };

    const mod = await Test.createTestingModule({
      providers: [
        VentasService,
        { provide: PrismaTenantService, useValue: prisma },
        { provide: InventarioService, useValue: inventario },
        { provide: MotorCuponesService, useValue: motorCupones },
        { provide: SerieCpeService, useValue: serieCpe },
        { provide: ConfiguracionFacturacionService, useValue: configFacturacion },
        { provide: AppEventEmitter, useValue: eventEmitter },
      ],
    }).compile();
    service = mod.get(VentasService);
  });

  // ---------- crear: validaciones tempranas ----------

  describe('crear (validaciones)', () => {
    it('rechaza venta sin items', async () => {
      await expect(
        service.crear({ sucursalId: 's', items: [] } as never, ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza si la sucursal no existe o está inactiva', async () => {
      tx.sucursal.findFirst.mockResolvedValue(null);
      await expect(
        service.crear(
          { sucursalId: 's-fake', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });

    it('rechaza si el cliente fue soft-deleted', async () => {
      tx.sucursal.findFirst.mockResolvedValue({ id: 's' });
      tx.cliente.findFirst.mockResolvedValue(null);
      await expect(
        service.crear(
          {
            sucursalId: 's',
            clienteId: 'c-fantasma',
            items: [{ varianteId: 'v1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });

    it('rechaza items duplicados (mismo varianteId más de una vez)', async () => {
      tx.sucursal.findFirst.mockResolvedValue({ id: 's' });
      await expect(
        service.crear(
          {
            sucursalId: 's',
            items: [
              { varianteId: 'v1', cantidad: 1 },
              { varianteId: 'v1', cantidad: 2 },
            ],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza si alguna variante no existe', async () => {
      tx.sucursal.findFirst.mockResolvedValue({ id: 's' });
      tx.variante.findMany.mockResolvedValue([]); // no encontró ninguna
      await expect(
        service.crear(
          { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza si el producto de la variante está soft-deleted', async () => {
      tx.sucursal.findFirst.mockResolvedValue({ id: 's' });
      tx.variante.findMany.mockResolvedValue([
        variante('v1', '10', { eliminadoEn: new Date() }),
      ]);
      await expect(
        service.crear(
          { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza precio unitario explícito <= 0', async () => {
      tx.sucursal.findFirst.mockResolvedValue({ id: 's' });
      tx.variante.findMany.mockResolvedValue([variante('v1', '10')]);
      await expect(
        service.crear(
          {
            sucursalId: 's',
            items: [{ varianteId: 'v1', cantidad: 1, precioUnitario: 0 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza descuento por item mayor al subtotal del item', async () => {
      tx.sucursal.findFirst.mockResolvedValue({ id: 's' });
      tx.variante.findMany.mockResolvedValue([variante('v1', '10')]);
      await expect(
        service.crear(
          {
            sucursalId: 's',
            items: [{ varianteId: 'v1', cantidad: 1, descuento: 999 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza pagos que exceden el total', async () => {
      mockHappyPath(tx);
      await expect(
        service.crear(
          {
            sucursalId: 's',
            items: [{ varianteId: 'v1', cantidad: 1 }],
            pagos: [{ medio: 'efectivo', monto: 9999 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });
  });

  // ---------- crear: sesión de caja ----------

  describe('crear (sesión de caja)', () => {
    beforeEach(() => mockHappyPath(tx));

    it('rechaza sesión de caja inexistente', async () => {
      tx.sesionCaja.findUnique.mockResolvedValue(null);
      await expect(
        service.crear(
          {
            sucursalId: 's',
            sesionCajaId: 'sess-fantasma',
            items: [{ varianteId: 'v1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });

    it('rechaza sesión de caja cerrada', async () => {
      tx.sesionCaja.findUnique.mockResolvedValue({
        id: 'sess1',
        estado: 'cerrada',
        sucursalId: 's',
        cajeroId: 'u1',
      });
      await expect(
        service.crear(
          {
            sucursalId: 's',
            sesionCajaId: 'sess1',
            items: [{ varianteId: 'v1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('rechaza sesión de otra sucursal', async () => {
      tx.sesionCaja.findUnique.mockResolvedValue({
        id: 'sess1',
        estado: 'abierta',
        sucursalId: 's-otra',
        cajeroId: 'u1',
      });
      await expect(
        service.crear(
          {
            sucursalId: 's',
            sesionCajaId: 'sess1',
            items: [{ varianteId: 'v1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza sesión de otro cajero', async () => {
      tx.sesionCaja.findUnique.mockResolvedValue({
        id: 'sess1',
        estado: 'abierta',
        sucursalId: 's',
        cajeroId: 'u-otro',
      });
      await expect(
        service.crear(
          {
            sucursalId: 's',
            sesionCajaId: 'sess1',
            items: [{ varianteId: 'v1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });
  });

  // ---------- crear: feliz path ----------

  describe('crear (feliz path)', () => {
    it('genera número correlativo basado en el max(numero) y NO en creadoEn', async () => {
      mockHappyPath(tx);
      tx.venta.findFirst.mockResolvedValue({ numero: 'V-000042' });
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      const findArg = tx.venta.findFirst.mock.calls[0][0];
      expect(findArg.orderBy).toEqual({ numero: 'desc' });
      const data = tx.venta.create.mock.calls[0][0].data;
      expect(data.numero).toBe('V-000043');
    });

    it('arranca en V-000001 cuando no hay ventas', async () => {
      mockHappyPath(tx);
      tx.venta.findFirst.mockResolvedValue(null);
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      expect(tx.venta.create.mock.calls[0][0].data.numero).toBe('V-000001');
    });

    it('toma advisory lock antes de generar el número', async () => {
      mockHappyPath(tx);
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('estado=pagada cuando pago cubre total exacto, parcial cuando es menor', async () => {
      mockHappyPath(tx);
      tx.venta.findFirst.mockResolvedValue(null);
      // precio 10 * 2 = 20 total
      await service.crear(
        {
          sucursalId: 's',
          items: [{ varianteId: 'v1', cantidad: 2 }],
          pagos: [{ medio: 'efectivo', monto: 20 }],
        } as never,
        ctx,
        'u1',
      );
      expect(tx.venta.create.mock.calls[0][0].data.estado).toBe('pagada');

      tx.venta.create.mockClear();
      await service.crear(
        {
          sucursalId: 's',
          items: [{ varianteId: 'v1', cantidad: 2 }],
          pagos: [{ medio: 'efectivo', monto: 5 }],
        } as never,
        ctx,
        'u1',
      );
      expect(tx.venta.create.mock.calls[0][0].data.estado).toBe('parcial');
    });

    it('estado=confirmada cuando NO hay pagos', async () => {
      mockHappyPath(tx);
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      expect(tx.venta.create.mock.calls[0][0].data.estado).toBe('confirmada');
    });

    it('descuenta stock por cada item con egreso_venta', async () => {
      mockHappyPath(tx);
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 3 }] } as never,
        ctx,
        'u1',
      );
      expect(inventario.ajustarEnTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          varianteId: 'v1',
          delta: -3,
          tipo: 'egreso_venta',
          referenciaTipo: 'Venta',
        }),
      );
    });

    it('incrementa totalCompras y ultimaCompraEn del cliente', async () => {
      mockHappyPath(tx);
      tx.cliente.findFirst.mockResolvedValue({
        id: 'c1',
        clasificacion: 'B',
        totalCompras: new Prisma.Decimal('100'),
        ultimaCompraEn: new Date('2026-01-01'),
      });
      await service.crear(
        {
          sucursalId: 's',
          clienteId: 'c1',
          items: [{ varianteId: 'v1', cantidad: 1 }],
        } as never,
        ctx,
        'u1',
      );
      expect(tx.cliente.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({
            totalCompras: { increment: 10 },
            ultimaCompraEn: expect.any(Date),
          }),
        }),
      );
    });

    it('redondea total a 2 decimales', async () => {
      mockHappyPath(tx);
      // precio 10.005 * 1 - desc 0 - cup 0 + imp 0 = 10.005 → debe redondear a 10.01
      tx.variante.findMany.mockResolvedValue([variante('v1', '10.005')]);
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      const data = tx.venta.create.mock.calls[0][0].data;
      // 10.005 redondeado a 2 → 10.01
      expect(data.total).toBeCloseTo(10.01, 2);
    });
  });

<<<<<<< HEAD
  // ---------- crear: costo congelado (snapshot rentabilidad) ----------

  describe('crear (costo congelado)', () => {
    it('congela costoUnitario desde producto.precioCompra', async () => {
      mockHappyPath(tx);
      tx.variante.findMany.mockResolvedValue([variante('v1', '10', { precioCompra: '6' })]);
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      const itemsCreate = tx.venta.create.mock.calls[0][0].data.items.create;
      expect(Number(itemsCreate[0].costoUnitario)).toBe(6);
      // Con precioCompra disponible NO se consulta el último costo de compra.
      expect(tx.compraItem.findMany).not.toHaveBeenCalled();
    });

    it('usa el último costo de compra cuando el producto no tiene precioCompra', async () => {
      mockHappyPath(tx);
      tx.variante.findMany.mockResolvedValue([variante('v1', '10', { precioCompra: null })]);
      tx.compraItem.findMany.mockResolvedValue([
        { varianteId: 'v1', costoUnitario: new Prisma.Decimal('4.5'), compra: { creadoEn: new Date() } },
      ]);
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      const itemsCreate = tx.venta.create.mock.calls[0][0].data.items.create;
      expect(Number(itemsCreate[0].costoUnitario)).toBe(4.5);
    });

    it('costoUnitario queda null si no hay precioCompra ni compras', async () => {
      mockHappyPath(tx); // compraItem.findMany → [] por defecto
      tx.variante.findMany.mockResolvedValue([variante('v1', '10', { precioCompra: null })]);
      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      const itemsCreate = tx.venta.create.mock.calls[0][0].data.items.create;
      expect(itemsCreate[0].costoUnitario).toBeNull();
=======
  // ---------- crear: guard SUNAT (boleta > S/700 requiere DNI) ----------

  describe('crear (guard identificación boleta > S/700)', () => {
    it('rechaza boleta > S/700 sin cliente cuando el tenant emite CPE', async () => {
      tx.sucursal.findFirst.mockResolvedValue({ id: 's' });
      tx.variante.findMany.mockResolvedValue([variante('v1', '800')]);
      configFacturacion.estaConfigurada.mockResolvedValue(true);
      await expect(
        service.crear(
          { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('permite boleta > S/700 con cliente DNI identificado', async () => {
      mockHappyPath(tx);
      tx.variante.findMany.mockResolvedValue([variante('v1', '800')]);
      configFacturacion.estaConfigurada.mockResolvedValue(true);
      tx.cliente.findFirst.mockResolvedValue({
        id: 'c1',
        tipoDocumento: 'dni',
        documento: '12345678',
        clasificacion: null,
        totalCompras: new Prisma.Decimal('0'),
        ultimaCompraEn: null,
      });
      await expect(
        service.crear(
          {
            sucursalId: 's',
            clienteId: 'c1',
            items: [{ varianteId: 'v1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).resolves.toBeDefined();
    });

    it('permite boleta > S/700 si es nota de venta interna (ni consulta config)', async () => {
      mockHappyPath(tx);
      tx.variante.findMany.mockResolvedValue([variante('v1', '800')]);
      await expect(
        service.crear(
          {
            sucursalId: 's',
            items: [{ varianteId: 'v1', cantidad: 1 }],
            esNotaDeVenta: true,
          } as never,
          ctx,
          'u1',
        ),
      ).resolves.toBeDefined();
      expect(configFacturacion.estaConfigurada).not.toHaveBeenCalled();
    });

    it('permite boleta > S/700 si el tenant no tiene facturación configurada', async () => {
      mockHappyPath(tx);
      tx.variante.findMany.mockResolvedValue([variante('v1', '800')]);
      configFacturacion.estaConfigurada.mockResolvedValue(false);
      await expect(
        service.crear(
          { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).resolves.toBeDefined();
>>>>>>> 7af26ac3e43321f6fdb1128c8298ba12a07f9eda
    });
  });

  // ---------- anular ----------

  describe('anular', () => {
    it('exige motivo no vacío', async () => {
      await expect(service.anular('id', '   ', ctx, 'u1')).rejects.toBeInstanceOf(
        ErrorValidacion,
      );
    });

    it('lanza ErrorNoEncontrado si la venta no existe', async () => {
      tx.venta.findFirst.mockResolvedValue(null);
      await expect(
        service.anular('id', 'porque sí', ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });

    it('rechaza con ErrorConflicto si la venta ya está anulada', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1',
        estado: 'anulada',
        items: [],
        cuponUso: null,
      });
      await expect(
        service.anular('v1', 'doble anulación', ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('devuelve stock con ingreso_devolucion por cada item', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1',
        numero: 'V-000001',
        sucursalId: 's',
        clienteId: null,
        estado: 'pagada',
        total: new Prisma.Decimal('50.00'),
        items: [
          { varianteId: 'a', cantidad: 2 },
          { varianteId: 'b', cantidad: 1 },
        ],
        cuponUso: null,
      });
      tx.venta.update.mockResolvedValue({ id: 'v1' });
      await service.anular('v1', 'cliente devolvió', ctx, 'u1');
      expect(inventario.ajustarEnTx).toHaveBeenCalledTimes(2);
      expect(inventario.ajustarEnTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ varianteId: 'a', delta: 2, tipo: 'ingreso_devolucion' }),
      );
    });

    it('libera el uso de cupón y revierte estado agotado→activo si el cupón sigue vigente', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1',
        numero: 'V-1',
        sucursalId: 's',
        clienteId: null,
        estado: 'pagada',
        total: new Prisma.Decimal('30'),
        items: [],
        cuponUso: { id: 'u1', cuponId: 'cup1' },
      });
      tx.cupon.findUnique.mockResolvedValue({
        estado: 'agotado',
        usosMaximosTotal: 5,
        fechaFin: new Date(Date.now() + 86400_000),
      });
      tx.venta.update.mockResolvedValue({ id: 'v1' });

      await service.anular('v1', 'devolución', ctx, 'u1');

      expect(tx.cuponUso.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(tx.cupon.update).toHaveBeenCalledWith({
        where: { id: 'cup1' },
        data: { estado: 'activo' },
      });
    });

    it('decrementa totalCompras del cliente y recalcula ultimaCompraEn con la venta previa', async () => {
      tx.venta.findFirst
        // primera llamada: la venta a anular
        .mockResolvedValueOnce({
          id: 'v1',
          numero: 'V-2',
          sucursalId: 's',
          clienteId: 'c1',
          estado: 'pagada',
          total: new Prisma.Decimal('40'),
          items: [],
          cuponUso: null,
        })
        // segunda llamada: venta previa NO anulada del cliente
        .mockResolvedValueOnce({ creadoEn: new Date('2026-04-01') });
      tx.venta.update.mockResolvedValue({ id: 'v1' });

      await service.anular('v1', 'devolución', ctx, 'u1');

      // 1ra update del cliente: decrement
      const updates = tx.cliente.update.mock.calls;
      expect(updates[0][0].data.totalCompras).toEqual({
        decrement: expect.any(Prisma.Decimal),
      });
      // 2da update: ultimaCompraEn = creadoEn de la previa
      expect(updates[1][0].data.ultimaCompraEn).toEqual(new Date('2026-04-01'));
    });

    it('si NO hay venta previa al anular, ultimaCompraEn queda en null', async () => {
      tx.venta.findFirst
        .mockResolvedValueOnce({
          id: 'v1',
          sucursalId: 's',
          clienteId: 'c1',
          estado: 'pagada',
          total: new Prisma.Decimal('40'),
          items: [],
          cuponUso: null,
        })
        .mockResolvedValueOnce(null);
      tx.venta.update.mockResolvedValue({ id: 'v1' });
      await service.anular('v1', 'devolución', ctx, 'u1');
      const ultimaUpdate = tx.cliente.update.mock.calls[1][0];
      expect(ultimaUpdate.data.ultimaCompraEn).toBeNull();
    });
  });

  // ---------- listar ----------

  describe('listar', () => {
    beforeEach(() => {
      tx.venta.findMany.mockResolvedValue([]);
      tx.venta.count.mockResolvedValue(0);
    });

    it('acepta un único estado válido', async () => {
      await service.listar({ estado: 'pagada' } as never, ctx);
      expect(tx.venta.findMany.mock.calls[0][0].where.estado).toBe('pagada');
    });

    it('parsea estado CSV → in:[...]', async () => {
      await service.listar({ estado: 'pagada,parcial,confirmada' } as never, ctx);
      const where = tx.venta.findMany.mock.calls[0][0].where;
      expect(where.estado).toEqual({ in: ['pagada', 'parcial', 'confirmada'] });
    });

    it('ignora estados inválidos en el CSV sin explotar', async () => {
      await service.listar({ estado: 'pagada,inventado,parcial' } as never, ctx);
      expect(tx.venta.findMany.mock.calls[0][0].where.estado).toEqual({
        in: ['pagada', 'parcial'],
      });
    });

    it('excluirAnuladas=true filtra por anuladaEn:null', async () => {
      await service.listar({ excluirAnuladas: 'true' } as never, ctx);
      expect(tx.venta.findMany.mock.calls[0][0].where.anuladaEn).toBeNull();
    });

    it('busca por número Y cliente.nombre con word-split AND', async () => {
      await service.listar({ buscar: 'V-001 juan' } as never, ctx);
      const where = tx.venta.findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(2);
      expect(where.AND[0].OR).toHaveLength(2);
      expect(where.AND[0].OR[0]).toEqual({
        numero: { contains: 'V-001', mode: 'insensitive' },
      });
      expect(where.AND[0].OR[1]).toEqual({
        cliente: { nombre: { contains: 'V-001', mode: 'insensitive' } },
      });
    });

    it('adjunta rentabilidad por venta (margen calculado de los ítems)', async () => {
      tx.venta.findMany.mockResolvedValue([
        { id: 'v1', descuento: new Prisma.Decimal('0'), descuentoCupon: new Prisma.Decimal('0') },
      ]);
      tx.venta.count.mockResolvedValue(1);
      tx.ventaItem.findMany.mockResolvedValue([
        { ventaId: 'v1', cantidad: 1, subtotal: new Prisma.Decimal('10'), costoUnitario: new Prisma.Decimal('6') },
      ]);
      const res = (await service.listar({} as never, ctx)) as unknown as {
        datos: Array<{ rentabilidad: { margenPct: number; nivel: string } }>;
      };
      const fila = res.datos[0]!;
      expect(fila.rentabilidad.margenPct).toBe(40);
      expect(fila.rentabilidad.nivel).toBe('saludable');
    });
  });

  // ---------- obtener ----------

  describe('obtener', () => {
    it('lanza ErrorNoEncontrado si no existe', async () => {
      tx.venta.findFirst.mockResolvedValue(null);
      await expect(service.obtener('xxx', ctx)).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });

    it('incluye cupon, cuponUso y notasCredito en el detalle', async () => {
      tx.venta.findFirst.mockResolvedValue({ id: 'v1' });
      await service.obtener('v1', ctx);
      const include = tx.venta.findFirst.mock.calls[0][0].include;
      expect(include.cupon).toBeDefined();
      expect(include.cuponUso).toBeDefined();
      expect(include.notasCredito).toBeDefined();
    });

    it('filtra eliminadoEn:null', async () => {
      tx.venta.findFirst.mockResolvedValue({ id: 'v1' });
      await service.obtener('v1', ctx);
      const where = tx.venta.findFirst.mock.calls[0][0].where;
      expect(where).toEqual({ id: 'v1', eliminadoEn: null });
    });
  });

  // ---------- registrarPago ----------

  describe('registrarPago', () => {
    it('rechaza monto <= 0', async () => {
      await expect(
        service.registrarPago('v1', { medio: 'efectivo', monto: 0 }, ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza venta inexistente', async () => {
      tx.venta.findFirst.mockResolvedValue(null);
      await expect(
        service.registrarPago('vx', { medio: 'efectivo', monto: 10 }, ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });

    it('rechaza venta anulada', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1', numero: 'V-1', estado: 'anulada', total: new Prisma.Decimal('100'),
        totalPagado: new Prisma.Decimal('0'), sucursalId: 's',
      });
      await expect(
        service.registrarPago('v1', { medio: 'efectivo', monto: 10 }, ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('rechaza venta ya pagada', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1', numero: 'V-1', estado: 'pagada', total: new Prisma.Decimal('100'),
        totalPagado: new Prisma.Decimal('100'), sucursalId: 's',
      });
      await expect(
        service.registrarPago('v1', { medio: 'efectivo', monto: 10 }, ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('rechaza monto que excede lo pendiente', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1', numero: 'V-1', estado: 'parcial', total: new Prisma.Decimal('100'),
        totalPagado: new Prisma.Decimal('80'), sucursalId: 's',
      });
      await expect(
        service.registrarPago('v1', { medio: 'efectivo', monto: 25 }, ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('promueve estado parcial→pagada cuando se cubre el pendiente', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1', numero: 'V-1', estado: 'parcial', total: new Prisma.Decimal('100'),
        totalPagado: new Prisma.Decimal('80'), sucursalId: 's',
      });
      tx.venta.update = jest.fn().mockResolvedValue({ id: 'v1' });
      // ventaPago.create
      (tx as any).ventaPago = { create: jest.fn().mockResolvedValue({ id: 'p1' }) };
      const res = await service.registrarPago(
        'v1', { medio: 'efectivo', monto: 20 }, ctx, 'u1',
      );
      expect(res.estado).toBe('pagada');
      expect(res.totalPagado).toBe(100);
    });

    it('mantiene estado parcial cuando aún falta', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1', numero: 'V-1', estado: 'parcial', total: new Prisma.Decimal('100'),
        totalPagado: new Prisma.Decimal('30'), sucursalId: 's',
      });
      tx.venta.update = jest.fn().mockResolvedValue({ id: 'v1' });
      (tx as any).ventaPago = { create: jest.fn().mockResolvedValue({ id: 'p1' }) };
      const res = await service.registrarPago(
        'v1', { medio: 'efectivo', monto: 20 }, ctx, 'u1',
      );
      expect(res.estado).toBe('parcial');
      expect(res.totalPagado).toBe(50);
    });

    it('valida sesión de caja (cerrada → 409)', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v1', numero: 'V-1', estado: 'parcial', total: new Prisma.Decimal('100'),
        totalPagado: new Prisma.Decimal('0'), sucursalId: 's',
      });
      tx.sesionCaja.findUnique.mockResolvedValue({
        id: 'sess', estado: 'cerrada', sucursalId: 's', cajeroId: 'u1',
      });
      await expect(
        service.registrarPago(
          'v1', { medio: 'efectivo', monto: 10, sesionCajaId: 'sess' }, ctx, 'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });
  });

  // ---------- crear: stamp tipoCpe + serie (etapa 3.4a) ----------

  describe('crear (stamp tipoCpe + serie)', () => {
    it('cliente con RUC → asigna tipoCpe=factura', async () => {
      mockHappyPath(tx);
      tx.cliente.findFirst.mockResolvedValue({
        id: 'c-ruc',
        clasificacion: null,
        totalCompras: new Prisma.Decimal('0'),
        ultimaCompraEn: null,
      });
      // venta.findUnique para stampearTipoCpeYSerie: devuelve cliente con RUC
      tx.venta.findUnique.mockResolvedValue({
        sucursalId: 's',
        cliente: { tipoDocumento: 'ruc' },
      });

      await service.crear(
        { sucursalId: 's', clienteId: 'c-ruc', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      // Esperar microtasks del fire-and-forget
      await new Promise(r => setTimeout(r, 0));

      expect(serieCpe.asignarProximoCorrelativoEnTenant).toHaveBeenCalledWith(
        expect.anything(),
        's',
        'factura',
      );
      expect(tx.venta.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'venta-1' },
          data: expect.objectContaining({ tipoCpe: 'factura', serieCpeId: 'serie-1', correlativo: '00000001' }),
        }),
      );
    });

    it('cliente con DNI → asigna tipoCpe=boleta', async () => {
      mockHappyPath(tx);
      tx.cliente.findFirst.mockResolvedValue({
        id: 'c-dni',
        clasificacion: null,
        totalCompras: new Prisma.Decimal('0'),
        ultimaCompraEn: null,
      });
      tx.venta.findUnique.mockResolvedValue({
        sucursalId: 's',
        cliente: { tipoDocumento: 'dni' },
      });

      await service.crear(
        { sucursalId: 's', clienteId: 'c-dni', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      await new Promise(r => setTimeout(r, 0));

      expect(serieCpe.asignarProximoCorrelativoEnTenant).toHaveBeenCalledWith(
        expect.anything(),
        's',
        'boleta',
      );
    });

    it('sin cliente (clienteId null) → asigna tipoCpe=boleta', async () => {
      mockHappyPath(tx);
      // Sin cliente: el select devuelve cliente: null
      tx.venta.findUnique.mockResolvedValue({
        sucursalId: 's',
        cliente: null,
      });

      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      await new Promise(r => setTimeout(r, 0));

      expect(serieCpe.asignarProximoCorrelativoEnTenant).toHaveBeenCalledWith(
        expect.anything(),
        's',
        'boleta',
      );
    });

    it('sin serie configurada → venta creada OK, stamp falla silenciosamente', async () => {
      mockHappyPath(tx);
      tx.venta.findUnique.mockResolvedValue({
        sucursalId: 's',
        cliente: null,
      });
      serieCpe.asignarProximoCorrelativoEnTenant.mockRejectedValue(
        new ErrorNoEncontrado('No hay serie activa configurada para sucursal s tipo boleta'),
      );

      // La venta debe retornar OK
      const resultado = await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      expect(resultado).toBeDefined();
      expect(resultado.id).toBe('venta-1');

      // Esperar a que el catch se ejecute
      await new Promise(r => setTimeout(r, 0));

      // No debe haberse llamado venta.update con stamp (el error se capturó antes)
      expect(tx.venta.update).not.toHaveBeenCalled();
    });

    it('error inesperado en stamp → venta retorna OK, error capturado sin re-lanzar', async () => {
      mockHappyPath(tx);
      tx.venta.findUnique.mockResolvedValue({
        sucursalId: 's',
        cliente: null,
      });
      serieCpe.asignarProximoCorrelativoEnTenant.mockRejectedValue(
        new Error('Timeout de conexión'),
      );

      const resultado = await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      // La venta retorna, el error no se re-lanza
      expect(resultado).toBeDefined();
      expect(resultado.id).toBe('venta-1');

      // Verificar que el proceso no explota después del flush
      await expect(new Promise(r => setTimeout(r, 0))).resolves.toBeUndefined();
    });

    it('stamp exitoso → emite evento venta.creada con ventaId y tenantCode', async () => {
      mockHappyPath(tx);
      tx.venta.findUnique.mockResolvedValue({
        sucursalId: 's',
        cliente: null,
      });

      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      // Esperar microtasks del fire-and-forget
      await new Promise(r => setTimeout(r, 0));

      expect(eventEmitter.emit).toHaveBeenCalledWith('venta.creada', {
        ventaId: 'venta-1',
        tenantCode: 'mi-tienda',
      });
    });

    it('stamp falla → NO emite evento venta.creada', async () => {
      mockHappyPath(tx);
      tx.venta.findUnique.mockResolvedValue({
        sucursalId: 's',
        cliente: null,
      });
      serieCpe.asignarProximoCorrelativoEnTenant.mockRejectedValue(
        new Error('No hay serie activa'),
      );

      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      await new Promise(r => setTimeout(r, 0));

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  // ---------- crear: nota de venta interna ----------

  describe('crear (esNotaDeVenta)', () => {
    it('esNotaDeVenta=true → persiste el flag en venta.create', async () => {
      mockHappyPath(tx);
      // venta.create devuelve esNotaDeVenta=true para reflejar lo persistido.
      tx.venta.create.mockResolvedValue({
        id: 'venta-nv',
        numero: 'V-000099',
        esNotaDeVenta: true,
        items: [],
        pagos: [],
      });

      await service.crear(
        {
          sucursalId: 's',
          items: [{ varianteId: 'v1', cantidad: 1 }],
          esNotaDeVenta: true,
        } as never,
        ctx,
        'u1',
      );

      expect(tx.venta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ esNotaDeVenta: true }),
        }),
      );
    });

    it('esNotaDeVenta=true → NO llama stampearTipoCpeYSerie ni emite venta.creada', async () => {
      mockHappyPath(tx);
      tx.venta.create.mockResolvedValue({
        id: 'venta-nv',
        numero: 'V-000099',
        esNotaDeVenta: true,
        items: [],
        pagos: [],
      });

      await service.crear(
        {
          sucursalId: 's',
          items: [{ varianteId: 'v1', cantidad: 1 }],
          esNotaDeVenta: true,
        } as never,
        ctx,
        'u1',
      );
      // Esperar microtasks por si el fire-and-forget se hubiera disparado.
      await new Promise(r => setTimeout(r, 0));

      expect(serieCpe.asignarProximoCorrelativoEnTenant).not.toHaveBeenCalled();
      expect(tx.venta.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('esNotaDeVenta omitido → default false, flujo normal con stamp', async () => {
      mockHappyPath(tx);
      tx.venta.create.mockResolvedValue({
        id: 'venta-1',
        numero: 'V-000001',
        esNotaDeVenta: false,
        items: [],
        pagos: [],
      });
      tx.venta.findUnique.mockResolvedValue({
        sucursalId: 's',
        cliente: null,
      });

      await service.crear(
        { sucursalId: 's', items: [{ varianteId: 'v1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      await new Promise(r => setTimeout(r, 0));

      expect(tx.venta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ esNotaDeVenta: false }),
        }),
      );
      expect(serieCpe.asignarProximoCorrelativoEnTenant).toHaveBeenCalled();
    });
  });
});

// ---------- helpers ----------

function variante(
  id: string,
  precio: string,
  producto?: { eliminadoEn?: Date | null; precioCompra?: string | null },
) {
  return {
    id,
    productoId: 'prod-' + id,
    talla: '10',
    color: 'azul',
    precioVenta: new Prisma.Decimal(precio),
    producto: {
      id: 'prod-' + id,
      nombre: 'Producto ' + id,
      precioVenta: new Prisma.Decimal(precio),
      precioCompra:
        producto?.precioCompra != null ? new Prisma.Decimal(producto.precioCompra) : null,
      categoriaId: 'cat-1',
      eliminadoEn: producto?.eliminadoEn ?? null,
    },
  };
}

/** Configura los mocks para que `crear` llegue al final con datos por defecto:
 * 1 variante v1 a precio 10, sucursal OK, sin cupón, sin sesión, sin cliente. */
function mockHappyPath(tx: ReturnType<typeof crearTxMock>) {
  tx.sucursal.findFirst.mockResolvedValue({ id: 's' });
  tx.variante.findMany.mockResolvedValue([variante('v1', '10')]);
  tx.venta.findFirst.mockResolvedValue(null);
  tx.venta.create.mockResolvedValue({
    id: 'venta-1',
    numero: 'V-000001',
    items: [],
    pagos: [],
  });
}
