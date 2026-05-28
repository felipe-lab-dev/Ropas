import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { NotasCreditoService } from './notas-credito.service';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { InventarioService } from '../inventario/inventario.service';
import { SerieCpeService } from '../facturacion-electronica/series-cpe/series-cpe.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function crearTxMock() {
  const venta: Mocked<{ findFirst: unknown }> = { findFirst: jest.fn() };
  const notaCredito: Mocked<{
    findFirst: unknown;
    findMany: unknown;
    count: unknown;
    create: unknown;
    update: unknown;
  }> = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const cliente: Mocked<{ update: unknown }> = { update: jest.fn() };
  // serieCpe se usa al asignar correlativo para NC cuando la venta tiene CPE.
  // Los tests legacy mockean venta sin documentoElectronico, así que estas
  // funciones quedan sin invocar — pero deben existir para que el código
  // compile y pueda inyectarse si el test lo requiere.
  const serieCpe: Mocked<{ findFirst: unknown; update: unknown }> = {
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const $executeRaw = jest.fn();
  return { venta, notaCredito, cliente, serieCpe, $executeRaw };
}

const ctx = {
  codigo: 'mi-tienda',
  schema: 'tenant_mitienda',
} as unknown as TenantContext;

describe('NotasCreditoService', () => {
  let service: NotasCreditoService;
  let tx: ReturnType<typeof crearTxMock>;
  let inventario: { ajustarEnTx: jest.Mock };

  beforeEach(async () => {
    tx = crearTxMock();
    inventario = { ajustarEnTx: jest.fn().mockResolvedValue({ stockAntes: 5, stockDespues: 6 }) };
    const cliente = {
      ...tx,
      $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const prisma = { forTenant: jest.fn().mockReturnValue(cliente) };

    const serieCpeService = {
      asignarProximoCorrelativo: jest.fn(),
      asignarProximoCorrelativoEnTenant: jest.fn(),
    };
    const mod = await Test.createTestingModule({
      providers: [
        NotasCreditoService,
        { provide: PrismaTenantService, useValue: prisma },
        { provide: InventarioService, useValue: inventario },
        { provide: SerieCpeService, useValue: serieCpeService },
      ],
    }).compile();
    service = mod.get(NotasCreditoService);
  });

  describe('crear (validaciones)', () => {
    it('rechaza items vacío', async () => {
      await expect(
        service.crear({ ventaId: 'v', motivo: 'x', items: [] } as never, ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza motivo vacío', async () => {
      await expect(
        service.crear(
          { ventaId: 'v', motivo: '   ', items: [{ ventaItemId: 'i', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza venta inexistente', async () => {
      tx.venta.findFirst.mockResolvedValue(null);
      await expect(
        service.crear(
          { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });

    it('rechaza NC sobre venta anulada', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v',
        estado: 'anulada',
        items: [],
        notasCredito: [],
      });
      await expect(
        service.crear(
          { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('rechaza item duplicado', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v',
        estado: 'pagada',
        items: [{ id: 'i1', cantidad: 2, subtotal: 20, descripcion: 'x', varianteId: 'va' }],
        notasCredito: [],
      });
      await expect(
        service.crear(
          {
            ventaId: 'v',
            motivo: 'm',
            items: [
              { ventaItemId: 'i1', cantidad: 1 },
              { ventaItemId: 'i1', cantidad: 1 },
            ],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza item que no pertenece a la venta', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v',
        estado: 'pagada',
        items: [{ id: 'i1', cantidad: 2, subtotal: 20, descripcion: 'x', varianteId: 'va' }],
        notasCredito: [],
      });
      await expect(
        service.crear(
          {
            ventaId: 'v',
            motivo: 'm',
            items: [{ ventaItemId: 'i-otra', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza cantidad mayor a lo disponible (vendido menos ya devuelto)', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v',
        estado: 'pagada',
        clienteId: null,
        sucursalId: 's',
        items: [{ id: 'i1', cantidad: 3, subtotal: 30, descripcion: 'x', varianteId: 'va' }],
        notasCredito: [
          {
            items: [{ ventaItemId: 'i1', cantidad: 2 }],
          },
        ],
      });
      await expect(
        service.crear(
          {
            ventaId: 'v',
            motivo: 'm',
            items: [{ ventaItemId: 'i1', cantidad: 2 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });
  });

  describe('crear (feliz path)', () => {
    beforeEach(() => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v',
        numero: 'V-000001',
        estado: 'pagada',
        clienteId: 'c1',
        sucursalId: 's',
        items: [
          { id: 'i1', cantidad: 2, subtotal: 20, descripcion: 'Polo · M/Azul', varianteId: 'va1' },
        ],
        notasCredito: [],
      });
      tx.notaCredito.create.mockResolvedValue({
        id: 'nc1',
        numero: 'NC-000001',
        items: [],
      });
    });

    it('genera número NC-NNNNNN ordenado por numero desc', async () => {
      tx.notaCredito.findFirst.mockResolvedValue({ numero: 'NC-000007' });
      await service.crear(
        { ventaId: 'v', motivo: 'devolución', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      const arg = tx.notaCredito.findFirst.mock.calls[0][0];
      expect(arg.orderBy).toEqual({ numero: 'desc' });
      expect(tx.notaCredito.create.mock.calls[0][0].data.numero).toBe('NC-000008');
    });

    it('NC-000001 cuando no hay previas', async () => {
      tx.notaCredito.findFirst.mockResolvedValue(null);
      await service.crear(
        { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      expect(tx.notaCredito.create.mock.calls[0][0].data.numero).toBe('NC-000001');
    });

    it('toma advisory lock antes de generar el número', async () => {
      tx.notaCredito.findFirst.mockResolvedValue(null);
      await service.crear(
        { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('calcula precio prorrateado por unidad (subtotal/cantidad del item original)', async () => {
      tx.notaCredito.findFirst.mockResolvedValue(null);
      // venta item: 2 unidades, subtotal 20 → 10 por unidad
      await service.crear(
        { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      const data = tx.notaCredito.create.mock.calls[0][0].data;
      expect(data.items.create[0].precioUnitario).toBe(10);
      expect(data.items.create[0].subtotal).toBe(10);
      expect(data.total).toBe(10);
    });

    it('restituye stock por default con ingreso_devolucion', async () => {
      tx.notaCredito.findFirst.mockResolvedValue(null);
      await service.crear(
        { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 2 }] } as never,
        ctx,
        'u1',
      );
      expect(inventario.ajustarEnTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          varianteId: 'va1',
          delta: 2,
          tipo: 'ingreso_devolucion',
          referenciaTipo: 'NotaCredito',
        }),
      );
    });

    it('si restituyeStock=false, NO ajusta inventario', async () => {
      tx.notaCredito.findFirst.mockResolvedValue(null);
      await service.crear(
        {
          ventaId: 'v',
          motivo: 'm',
          restituyeStock: false,
          items: [{ ventaItemId: 'i1', cantidad: 1 }],
        } as never,
        ctx,
        'u1',
      );
      expect(inventario.ajustarEnTx).not.toHaveBeenCalled();
    });

    it('decrementa totalCompras del cliente por el total de la NC', async () => {
      tx.notaCredito.findFirst.mockResolvedValue(null);
      await service.crear(
        { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      expect(tx.cliente.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { totalCompras: { decrement: expect.any(Prisma.Decimal) } },
      });
    });

    it('si la venta es de consumidor final (clienteId=null), NO toca cliente', async () => {
      tx.venta.findFirst.mockResolvedValue({
        id: 'v',
        numero: 'V-1',
        estado: 'pagada',
        clienteId: null,
        sucursalId: 's',
        items: [{ id: 'i1', cantidad: 1, subtotal: 5, descripcion: 'x', varianteId: 'va1' }],
        notasCredito: [],
      });
      tx.notaCredito.findFirst.mockResolvedValue(null);
      await service.crear(
        { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      expect(tx.cliente.update).not.toHaveBeenCalled();
    });
  });

  describe('anular', () => {
    it('exige motivo no vacío', async () => {
      await expect(service.anular('nc', '  ', ctx, 'u1')).rejects.toBeInstanceOf(
        ErrorValidacion,
      );
    });

    it('rechaza NC inexistente', async () => {
      tx.notaCredito.findFirst.mockResolvedValue(null);
      await expect(service.anular('nc', 'motivo', ctx, 'u1')).rejects.toBeInstanceOf(
        ErrorNoEncontrado,
      );
    });

    it('rechaza NC ya anulada', async () => {
      tx.notaCredito.findFirst.mockResolvedValue({
        id: 'nc',
        estado: 'anulada',
        items: [],
        venta: { id: 'v', numero: 'V-1', sucursalId: 's', clienteId: null },
      });
      await expect(
        service.anular('nc', 'motivo', ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('saca stock con egreso_ajuste si la NC había restituido', async () => {
      tx.notaCredito.findFirst.mockResolvedValue({
        id: 'nc',
        numero: 'NC-1',
        estado: 'emitida',
        restituyeStock: true,
        total: new Prisma.Decimal('10'),
        items: [{ varianteId: 'va1', cantidad: 1 }],
        venta: { id: 'v', numero: 'V-1', sucursalId: 's', clienteId: null },
      });
      tx.notaCredito.update.mockResolvedValue({ id: 'nc' });
      await service.anular('nc', 'error', ctx, 'u1');
      expect(inventario.ajustarEnTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ delta: -1, tipo: 'egreso_ajuste' }),
      );
    });

    it('NO toca stock si la NC no había restituido', async () => {
      tx.notaCredito.findFirst.mockResolvedValue({
        id: 'nc',
        numero: 'NC-1',
        estado: 'emitida',
        restituyeStock: false,
        total: new Prisma.Decimal('10'),
        items: [{ varianteId: 'va1', cantidad: 1 }],
        venta: { id: 'v', numero: 'V-1', sucursalId: 's', clienteId: null },
      });
      tx.notaCredito.update.mockResolvedValue({ id: 'nc' });
      await service.anular('nc', 'error', ctx, 'u1');
      expect(inventario.ajustarEnTx).not.toHaveBeenCalled();
    });

    it('revierte el decremento de totalCompras del cliente', async () => {
      tx.notaCredito.findFirst.mockResolvedValue({
        id: 'nc',
        numero: 'NC-1',
        estado: 'emitida',
        restituyeStock: true,
        total: new Prisma.Decimal('25'),
        items: [{ varianteId: 'va1', cantidad: 1 }],
        venta: { id: 'v', numero: 'V-1', sucursalId: 's', clienteId: 'c1' },
      });
      tx.notaCredito.update.mockResolvedValue({ id: 'nc' });
      await service.anular('nc', 'error', ctx, 'u1');
      expect(tx.cliente.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { totalCompras: { increment: expect.any(Prisma.Decimal) } },
      });
    });
  });
});
