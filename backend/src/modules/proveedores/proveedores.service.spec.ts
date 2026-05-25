import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ProveedoresService } from './proveedores.service';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function crearClienteMock() {
  const proveedor: Mocked<{
    findMany: unknown;
    findFirst: unknown;
    count: unknown;
    create: unknown;
    update: unknown;
  }> = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const compra: Mocked<{
    findMany: unknown;
    findFirst: unknown;
    count: unknown;
    aggregate: unknown;
  }> = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  };
  return { proveedor, compra };
}

const ctx = { codigo: 'mi-tienda', schema: 'tenant_mitienda' } as unknown as TenantContext;

describe('ProveedoresService', () => {
  let service: ProveedoresService;
  let cliente: ReturnType<typeof crearClienteMock>;
  let prisma: { forTenant: jest.Mock };

  beforeEach(async () => {
    cliente = crearClienteMock();
    prisma = { forTenant: jest.fn().mockReturnValue(cliente) };

    const mod = await Test.createTestingModule({
      providers: [
        ProveedoresService,
        { provide: PrismaTenantService, useValue: prisma },
      ],
    }).compile();

    service = mod.get(ProveedoresService);
  });

  // ---------- listar ----------

  describe('listar', () => {
    it('aplica eliminadoEn:null, paginación y orden por activo/razónSocial', async () => {
      cliente.proveedor.findMany.mockResolvedValue([{ id: 'p1' }]);
      cliente.proveedor.count.mockResolvedValue(1);

      const res = await service.listar({ pagina: 1, limite: 30, orden: 'desc' } as never, ctx);

      expect(prisma.forTenant).toHaveBeenCalledWith(ctx);
      const argFind = cliente.proveedor.findMany.mock.calls[0][0];
      expect(argFind.where).toEqual({ eliminadoEn: null });
      expect(argFind.skip).toBe(0);
      expect(argFind.take).toBe(30);
      expect(argFind.orderBy).toEqual([{ activo: 'desc' }, { razonSocial: 'asc' }]);
      expect(res.total).toBe(1);
      expect(res.pagina).toBe(1);
    });

    it('mapea filtros activo=true y condicionPago', async () => {
      cliente.proveedor.findMany.mockResolvedValue([]);
      cliente.proveedor.count.mockResolvedValue(0);

      await service.listar(
        { pagina: 1, limite: 20, activo: 'true', condicionPago: 'credito_30', orden: 'desc' } as never,
        ctx,
      );
      const where = cliente.proveedor.findMany.mock.calls[0][0].where;
      expect(where.activo).toBe(true);
      expect(where.condicionPago).toBe('credito_30');
    });

    it('agrega búsqueda word-split sobre múltiples campos', async () => {
      cliente.proveedor.findMany.mockResolvedValue([]);
      cliente.proveedor.count.mockResolvedValue(0);

      await service.listar(
        { pagina: 1, limite: 20, orden: 'desc', buscar: 'textil lima' } as never,
        ctx,
      );
      const where = cliente.proveedor.findMany.mock.calls[0][0].where;
      // Dos palabras → AND con OR por cada una sobre los 5 campos
      expect(where.AND).toBeDefined();
      expect(where.AND).toHaveLength(2);
      expect(where.AND[0].OR.map((o: Record<string, unknown>) => Object.keys(o)[0])).toEqual([
        'razonSocial', 'nombreComercial', 'documento', 'contacto', 'email',
      ]);
    });
  });

  // ---------- obtener ----------

  describe('obtener', () => {
    it('lanza ErrorNoEncontrado si no existe (incluye soft-deleted)', async () => {
      cliente.proveedor.findFirst.mockResolvedValue(null);
      await expect(service.obtener('aaa', ctx)).rejects.toBeInstanceOf(ErrorNoEncontrado);
      expect(cliente.proveedor.findFirst).toHaveBeenCalledWith({
        where: { id: 'aaa', eliminadoEn: null },
      });
    });

    it('retorna el proveedor cuando existe', async () => {
      const fake = { id: 'p1', razonSocial: 'ACME' };
      cliente.proveedor.findFirst.mockResolvedValue(fake);
      await expect(service.obtener('p1', ctx)).resolves.toBe(fake);
    });
  });

  // ---------- detalle ----------

  describe('detalle', () => {
    it('calcula deuda viva sumando solo compras pendientes/parciales/vencidas no anuladas', async () => {
      const prov = { id: 'p1', razonSocial: 'ACME', tipoDocumento: 'ruc' };
      cliente.proveedor.findFirst.mockResolvedValue(prov);
      cliente.compra.count.mockResolvedValue(3);
      cliente.compra.findFirst.mockResolvedValue({
        id: 'c1', numero: 'C-1', total: new Prisma.Decimal('100.00'), fechaEmision: new Date('2026-01-01'),
      });
      cliente.compra.aggregate.mockResolvedValue({
        _sum: {
          total: new Prisma.Decimal('500.00'),
          totalPagado: new Prisma.Decimal('150.50'),
        },
      });

      const res = await service.detalle('p1', ctx);

      expect(res.stats.totalCompras).toBe(3);
      expect(res.stats.deudaCalculada).toBe('349.50');
      const whereAgg = cliente.compra.aggregate.mock.calls[0][0].where;
      expect(whereAgg.proveedorId).toBe('p1');
      expect(whereAgg.eliminadoEn).toBeNull();
      expect(whereAgg.anuladaEn).toBeNull();
      expect(whereAgg.estadoPago).toEqual({ in: ['pendiente', 'parcial', 'vencida'] });
    });

    it('cuando no hay compras devuelve deuda 0.00', async () => {
      cliente.proveedor.findFirst.mockResolvedValue({ id: 'p1' });
      cliente.compra.count.mockResolvedValue(0);
      cliente.compra.findFirst.mockResolvedValue(null);
      cliente.compra.aggregate.mockResolvedValue({ _sum: { total: null, totalPagado: null } });

      const res = await service.detalle('p1', ctx);
      expect(res.stats.totalCompras).toBe(0);
      expect(res.stats.ultimaCompra).toBeNull();
      expect(res.stats.deudaCalculada).toBe('0.00');
    });
  });

  // ---------- historial ----------

  describe('historial', () => {
    it('valida la existencia del proveedor antes de listar y limita a 50', async () => {
      cliente.proveedor.findFirst.mockResolvedValue({ id: 'p1' });
      cliente.compra.findMany.mockResolvedValue([]);
      await service.historial('p1', ctx);
      const arg = cliente.compra.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ proveedorId: 'p1', eliminadoEn: null });
      expect(arg.take).toBe(50);
      expect(arg.orderBy).toEqual({ fechaEmision: 'desc' });
    });

    it('lanza ErrorNoEncontrado si el proveedor no existe', async () => {
      cliente.proveedor.findFirst.mockResolvedValue(null);
      await expect(service.historial('xxx', ctx)).rejects.toBeInstanceOf(ErrorNoEncontrado);
      expect(cliente.compra.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------- crear ----------

  describe('crear', () => {
    const dto = {
      tipoDocumento: 'ruc' as const,
      documento: '20123456789',
      razonSocial: 'DISTRIBUIDORA SAC',
      condicionPago: 'contado' as const,
    };

    it('lanza ErrorConflicto si ya existe un proveedor con mismo (tipoDocumento, documento) activo', async () => {
      cliente.proveedor.findFirst.mockResolvedValue({ id: 'p99', razonSocial: 'OTRA' });
      await expect(service.crear(dto, ctx)).rejects.toBeInstanceOf(ErrorConflicto);
      expect(cliente.proveedor.create).not.toHaveBeenCalled();
    });

    it('ignora soft-deleted al chequear duplicados (filtra eliminadoEn:null)', async () => {
      cliente.proveedor.findFirst.mockResolvedValue(null);
      cliente.proveedor.create.mockResolvedValue({ id: 'p1' });
      await service.crear(dto, ctx);
      const arg = cliente.proveedor.findFirst.mock.calls[0][0];
      expect(arg.where.eliminadoEn).toBeNull();
    });

    it('aplica defaults: condicionPago=contado, diasCredito=0, tags=[]', async () => {
      cliente.proveedor.findFirst.mockResolvedValue(null);
      cliente.proveedor.create.mockResolvedValue({ id: 'p1' });
      await service.crear(
        { tipoDocumento: 'dni', documento: '12345678', razonSocial: 'JUAN' } as never,
        ctx,
      );
      const data = cliente.proveedor.create.mock.calls[0][0].data;
      expect(data.condicionPago).toBe('contado');
      expect(data.diasCredito).toBe(0);
      expect(data.tags).toEqual([]);
      expect(data.nombreComercial).toBeNull();
    });
  });

  // ---------- actualizar ----------

  describe('actualizar', () => {
    it('si no cambian tipoDocumento ni documento no valida duplicados', async () => {
      cliente.proveedor.findFirst
        .mockResolvedValueOnce({ id: 'p1', tipoDocumento: 'ruc', documento: '20123456789' });
      cliente.proveedor.update.mockResolvedValue({ id: 'p1' });
      await service.actualizar('p1', { razonSocial: 'NUEVO' }, ctx);
      expect(cliente.proveedor.findFirst).toHaveBeenCalledTimes(1); // solo el obtener
    });

    it('si cambia el documento valida que no choque con otro proveedor', async () => {
      cliente.proveedor.findFirst
        .mockResolvedValueOnce({ id: 'p1', tipoDocumento: 'ruc', documento: '20111111111' })
        .mockResolvedValueOnce({ id: 'p2', razonSocial: 'CHOCA' });

      await expect(
        service.actualizar('p1', { documento: '20222222222' }, ctx),
      ).rejects.toBeInstanceOf(ErrorConflicto);

      const where = cliente.proveedor.findFirst.mock.calls[1][0].where;
      expect(where.id).toEqual({ not: 'p1' });
      expect(where.documento).toBe('20222222222');
    });

    it('aplica solo los campos provistos (no pisa con undefined)', async () => {
      cliente.proveedor.findFirst.mockResolvedValueOnce({ id: 'p1', tipoDocumento: 'ruc', documento: '1' });
      cliente.proveedor.update.mockResolvedValue({ id: 'p1' });
      await service.actualizar('p1', { activo: false, notas: null } as never, ctx);

      const data = cliente.proveedor.update.mock.calls[0][0].data;
      expect(data).toEqual({ activo: false, notas: null });
    });
  });

  // ---------- eliminar ----------

  describe('eliminar', () => {
    it('bloquea con ErrorValidacion si hay compras con saldo abierto', async () => {
      cliente.proveedor.findFirst.mockResolvedValue({ id: 'p1' });
      cliente.compra.count.mockResolvedValue(2);

      await expect(service.eliminar('p1', ctx)).rejects.toBeInstanceOf(ErrorValidacion);
      expect(cliente.proveedor.update).not.toHaveBeenCalled();

      const where = cliente.compra.count.mock.calls[0][0].where;
      expect(where.estadoPago).toEqual({ in: ['pendiente', 'parcial', 'vencida'] });
      expect(where.anuladaEn).toBeNull();
    });

    it('hace soft delete (eliminadoEn + activo:false) cuando no hay compras abiertas', async () => {
      cliente.proveedor.findFirst.mockResolvedValue({ id: 'p1' });
      cliente.compra.count.mockResolvedValue(0);
      cliente.proveedor.update.mockResolvedValue({ id: 'p1' });

      await service.eliminar('p1', ctx);
      const arg = cliente.proveedor.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'p1' });
      expect(arg.data.activo).toBe(false);
      expect(arg.data.eliminadoEn).toBeInstanceOf(Date);
    });
  });
});
