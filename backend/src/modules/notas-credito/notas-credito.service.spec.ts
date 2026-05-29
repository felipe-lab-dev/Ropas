import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { NotasCreditoService } from './notas-credito.service';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { InventarioService } from '../inventario/inventario.service';
import { SerieCpeService } from '../facturacion-electronica/series-cpe/series-cpe.service';
import { AppEventEmitter } from '../../core/events/app-event-emitter';
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
  const serieCpe: Mocked<{ findFirst: unknown; update: unknown }> = {
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  // configuracionFacturacion se consulta para detectar si el tenant usa
  // facturación electrónica. Default: null (tenant legacy, sin fac elec).
  const configuracionFacturacion: Mocked<{ findFirst: unknown }> = {
    findFirst: jest.fn().mockResolvedValue(null),
  };
  const $executeRaw = jest.fn();
  return { venta, notaCredito, cliente, serieCpe, configuracionFacturacion, $executeRaw };
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
    // Stub minimal: capturamos emit() para que el service no rompa al disparar
    // 'nota-credito.creada' post-commit. No nos importa la suscripción aquí.
    const eventEmitter = { emit: jest.fn(), on: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        NotasCreditoService,
        { provide: PrismaTenantService, useValue: prisma },
        { provide: InventarioService, useValue: inventario },
        { provide: SerieCpeService, useValue: serieCpeService },
        { provide: AppEventEmitter, useValue: eventEmitter },
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

  // ─── Bloqueo fiscal: NC sobre venta sin CPE cuando hay fac elec activa ─────
  describe('crear (con facturación electrónica activa)', () => {
    beforeEach(() => {
      // Tenant con ConfiguracionFacturacion → usa fac elec
      tx.configuracionFacturacion.findFirst.mockResolvedValue({
        id: 'cfg-1',
        ruc: '20100100100',
      });
      tx.venta.findFirst.mockResolvedValue({
        id: 'v',
        numero: 'V-000077',
        estado: 'pagada',
        clienteId: 'c1',
        sucursalId: 's',
        items: [
          { id: 'i1', cantidad: 2, subtotal: 20, descripcion: 'Polo · M', varianteId: 'va1' },
        ],
        notasCredito: [],
        documentoElectronico: null, // ← venta SIN CPE emitido
      });
    });

    it('bloquea NC con ErrorConflicto si el tenant tiene fac elec y la venta no tiene CPE emitido', async () => {
      await expect(
        service.crear(
          { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toBeInstanceOf(ErrorConflicto);
      await expect(
        service.crear(
          { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
          ctx,
          'u1',
        ),
      ).rejects.toThrow(/V-000077.*no tiene comprobante electrónico emitido|no tiene comprobante electrónico emitido.*V-000077/);
      expect(tx.notaCredito.create).not.toHaveBeenCalled();
    });

    it('NO bloquea cuando el tenant NO tiene fac elec configurada (flujo legacy)', async () => {
      tx.configuracionFacturacion.findFirst.mockResolvedValue(null);
      tx.notaCredito.findFirst.mockResolvedValue(null);
      tx.notaCredito.create.mockResolvedValue({ id: 'nc-legacy', numero: 'NC-1', items: [] });
      await service.crear(
        { ventaId: 'v', motivo: 'm', items: [{ ventaItemId: 'i1', cantidad: 1 }] } as never,
        ctx,
        'u1',
      );
      // La NC se crea sin campos SUNAT (flujo legacy: spread vacío en data)
      expect(tx.notaCredito.create).toHaveBeenCalled();
      const dataCreada = tx.notaCredito.create.mock.calls[0][0].data;
      expect(dataCreada.tipoCpe).toBeUndefined();
      expect(dataCreada.serieCpeId).toBeUndefined();
      expect(dataCreada.tipoCpeOriginal).toBeUndefined();
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

  // ---------- 3 ramas según modalidad de la venta original ----------

  describe('crear (3 ramas: nota de venta interna, bloqueo sin CPE, mensajes CPE)', () => {
    function ventaConCpeOriginal(
      docOriginal: { tipoCpe: 'factura' | 'boleta'; estadoSunat: string; serie: string; correlativo: string } | null,
      override: Record<string, unknown> = {},
    ) {
      return {
        id: 'v',
        numero: 'V-000099',
        estado: 'pagada',
        clienteId: 'c1',
        sucursalId: 's',
        esNotaDeVenta: false,
        items: [
          { id: 'i1', cantidad: 2, subtotal: 20, descripcion: 'Polo · M/Azul', varianteId: 'va1' },
        ],
        notasCredito: [],
        documentoElectronico: docOriginal,
        ...override,
      };
    }

    it('A) venta esNotaDeVenta=true + tenant CON facElec → NC se crea SIN datos SUNAT (devolución interna)', async () => {
      // Tenant SÍ tiene facElec configurada.
      tx.configuracionFacturacion.findFirst.mockResolvedValue({ id: 'cfg-1' });
      tx.venta.findFirst.mockResolvedValue(
        ventaConCpeOriginal(null, { esNotaDeVenta: true }),
      );
      // El listener serviría para emitir; lo mockeamos vacío.
      tx.notaCredito.findFirst.mockResolvedValue({ numero: 'NC-000000' });
      tx.notaCredito.create.mockResolvedValue({
        id: 'nc-interna',
        numero: 'NC-000001',
        items: [],
      });

      await service.crear(
        {
          ventaId: 'v',
          motivo: 'cliente arrepentido',
          items: [{ ventaItemId: 'i1', cantidad: 1 }],
        } as never,
        ctx,
        'u1',
      );

      // Se creó la NC; los datos SUNAT no deben aparecer en el data del create.
      const callData = tx.notaCredito.create.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('tipoCpe');
      expect(callData).not.toHaveProperty('serieCpeId');
      expect(callData).not.toHaveProperty('correlativo');
      expect(callData).not.toHaveProperty('tipoCpeOriginal');
      // Pero stock se ajusta y motivo persistido normal.
      expect(inventario.ajustarEnTx).toHaveBeenCalled();
      expect(callData.motivo).toBe('cliente arrepentido');
    });

    it('B) tenant CON facElec + venta NO nota de venta + sin documentoElectronico → bloquea pidiendo emitir CPE', async () => {
      tx.configuracionFacturacion.findFirst.mockResolvedValue({ id: 'cfg-1' });
      tx.venta.findFirst.mockResolvedValue(
        ventaConCpeOriginal(null, { esNotaDeVenta: false }),
      );

      await expect(
        service.crear(
          {
            ventaId: 'v',
            motivo: 'devolución',
            items: [{ ventaItemId: 'i1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toMatchObject({
        codigo: 409,
      });
      await expect(
        service.crear(
          {
            ventaId: 'v',
            motivo: 'devolución',
            items: [{ ventaItemId: 'i1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toThrow(/no tiene comprobante electrónico emitido/i);
    });

    it('C1) CPE original en estado pendiente → ErrorConflicto con mensaje "Reintenta primero"', async () => {
      tx.configuracionFacturacion.findFirst.mockResolvedValue({ id: 'cfg-1' });
      tx.venta.findFirst.mockResolvedValue(
        ventaConCpeOriginal({
          tipoCpe: 'factura',
          estadoSunat: 'pendiente',
          serie: 'F001',
          correlativo: '00000045',
        }),
      );

      await expect(
        service.crear(
          {
            ventaId: 'v',
            motivo: 'devolución',
            items: [{ ventaItemId: 'i1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toThrow(/nunca llegó a SUNAT/i);
      await expect(
        service.crear(
          {
            ventaId: 'v',
            motivo: 'devolución',
            items: [{ ventaItemId: 'i1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toThrow(/Reintenta.*emisión del comprobante/i);
    });

    it('C2) CPE original en estado rechazado → ErrorConflicto con mensaje sobre comprobante rechazado', async () => {
      tx.configuracionFacturacion.findFirst.mockResolvedValue({ id: 'cfg-1' });
      tx.venta.findFirst.mockResolvedValue(
        ventaConCpeOriginal({
          tipoCpe: 'boleta',
          estadoSunat: 'rechazado',
          serie: 'B001',
          correlativo: '00000010',
        }),
      );

      await expect(
        service.crear(
          {
            ventaId: 'v',
            motivo: 'devolución',
            items: [{ ventaItemId: 'i1', cantidad: 1 }],
          } as never,
          ctx,
          'u1',
        ),
      ).rejects.toThrow(/rechazado por SUNAT/i);
    });
  });
});
