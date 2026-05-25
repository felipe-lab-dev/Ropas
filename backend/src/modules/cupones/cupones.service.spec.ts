import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CuponesService } from './cupones.service';
import { MotorCuponesService } from './motor-cupones.service';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function crearClienteMock() {
  return {
    cupon: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as Mocked<{
      findMany: unknown; findFirst: unknown; count: unknown; create: unknown; update: unknown;
    }>,
    cuponUso: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    } as Mocked<{ count: unknown; aggregate: unknown; groupBy: unknown; findMany: unknown }>,
    cliente: {
      findFirst: jest.fn(),
    } as Mocked<{ findFirst: unknown }>,
    variante: {
      findUnique: jest.fn(),
    } as Mocked<{ findUnique: unknown }>,
  };
}

const ctx = { codigo: 'mi-tienda', schemaName: 'tenant_mi_tienda' } as unknown as TenantContext;

describe('CuponesService', () => {
  let service: CuponesService;
  let cliente: ReturnType<typeof crearClienteMock>;
  let prisma: { forTenant: jest.Mock };

  beforeEach(async () => {
    cliente = crearClienteMock();
    prisma = { forTenant: jest.fn().mockReturnValue(cliente) };

    const mod = await Test.createTestingModule({
      providers: [
        CuponesService,
        MotorCuponesService,
        { provide: PrismaTenantService, useValue: prisma },
      ],
    }).compile();

    service = mod.get(CuponesService);
  });

  // ─── LISTAR ──────────────────────────────────────────────────────────

  describe('listar', () => {
    it('aplica eliminadoEn:null y paginación', async () => {
      cliente.cupon.findMany.mockResolvedValue([]);
      cliente.cupon.count.mockResolvedValue(0);
      await service.listar({ pagina: 1, limite: 30, orden: 'desc' } as never, ctx);
      const arg = cliente.cupon.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ eliminadoEn: null });
      expect(arg.skip).toBe(0);
      expect(arg.take).toBe(30);
    });

    it('filtra por estado y segmento', async () => {
      cliente.cupon.findMany.mockResolvedValue([]);
      cliente.cupon.count.mockResolvedValue(0);
      await service.listar(
        { pagina: 1, limite: 20, estado: 'activo', segmento: 'vip_a', orden: 'desc' } as never,
        ctx,
      );
      const where = cliente.cupon.findMany.mock.calls[0][0].where;
      expect(where.estado).toBe('activo');
      expect(where.segmento).toBe('vip_a');
    });

    it('vigentes=true exige fechaInicio<=now, fechaFin>=now, estado=activo', async () => {
      cliente.cupon.findMany.mockResolvedValue([]);
      cliente.cupon.count.mockResolvedValue(0);
      await service.listar(
        { pagina: 1, limite: 20, vigentes: 'true', orden: 'desc' } as never,
        ctx,
      );
      const where = cliente.cupon.findMany.mock.calls[0][0].where;
      expect(where.estado).toBe('activo');
      expect(where.fechaInicio.lte).toBeInstanceOf(Date);
      expect(where.fechaFin.gte).toBeInstanceOf(Date);
    });

    it('búsqueda word-split sobre código/nombre/descripcion/campania', async () => {
      cliente.cupon.findMany.mockResolvedValue([]);
      cliente.cupon.count.mockResolvedValue(0);
      await service.listar(
        { pagina: 1, limite: 20, buscar: 'verano vip', orden: 'desc' } as never,
        ctx,
      );
      const where = cliente.cupon.findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(2);
      expect(where.AND[0].OR.map((o: Record<string, unknown>) => Object.keys(o)[0])).toEqual([
        'codigo', 'nombre', 'descripcion', 'campania',
      ]);
    });
  });

  // ─── OBTENER ─────────────────────────────────────────────────────────

  describe('obtener', () => {
    it('lanza 404 si no existe', async () => {
      cliente.cupon.findFirst.mockResolvedValue(null);
      await expect(service.obtener('x', ctx)).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });

    it('busca solo no eliminados', async () => {
      cliente.cupon.findFirst.mockResolvedValue({ id: 'c1' });
      await service.obtener('c1', ctx);
      const where = cliente.cupon.findFirst.mock.calls[0][0].where;
      expect(where.eliminadoEn).toBeNull();
    });
  });

  // ─── CREAR ───────────────────────────────────────────────────────────

  describe('crear', () => {
    const base = {
      codigo: 'TEST-01',
      nombre: 'Cupón test',
      tipoDescuento: 'porcentaje' as const,
      valorDescuento: 20,
      fechaInicio: '2026-05-25T00:00:00.000Z',
      fechaFin: '2026-06-25T00:00:00.000Z',
    };

    it('rechaza si código ya existe', async () => {
      cliente.cupon.findFirst.mockResolvedValue({ id: 'existente' });
      await expect(service.crear(base as never, ctx)).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('rechaza si fechaFin <= fechaInicio', async () => {
      await expect(
        service.crear(
          { ...base, fechaFin: '2026-05-25T00:00:00.000Z' } as never,
          ctx,
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza porcentaje fuera de 1-100', async () => {
      await expect(
        service.crear({ ...base, tipoDescuento: 'porcentaje', valorDescuento: 150 } as never, ctx),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza aplicableA=categorias sin categorías', async () => {
      cliente.cupon.findFirst.mockResolvedValue(null);
      await expect(
        service.crear(
          { ...base, aplicableA: 'categorias', categoriasAplicablesIds: [] } as never,
          ctx,
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza segmento=lista_clientes sin clientes', async () => {
      cliente.cupon.findFirst.mockResolvedValue(null);
      await expect(
        service.crear(
          { ...base, segmento: 'lista_clientes', clientesElegiblesIds: [] } as never,
          ctx,
        ),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('crea con defaults correctos', async () => {
      cliente.cupon.findFirst.mockResolvedValue(null);
      cliente.cupon.create.mockResolvedValue({ id: 'nuevo' });
      await service.crear(base as never, ctx, 'usr-1');
      const data = cliente.cupon.create.mock.calls[0][0].data;
      expect(data.codigo).toBe('TEST-01');
      expect(data.segmento).toBe('todos');
      expect(data.aplicableA).toBe('toda_compra');
      expect(data.usosMaximosPorCliente).toBe(1);
      expect(data.disenoColorPrimario).toBe('#7c3aed');
      expect(data.creadoPorId).toBe('usr-1');
      expect(data.valorDescuento).toBeInstanceOf(Prisma.Decimal);
    });
  });

  // ─── DESDE PLANTILLA ─────────────────────────────────────────────────

  describe('crearDesdePlantilla', () => {
    it('lanza si la plantilla no existe', async () => {
      await expect(
        service.crearDesdePlantilla({ plantilla: 'inexistente' } as never, ctx),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('hidrata todos los campos de la plantilla bienvenida_vip', async () => {
      cliente.cupon.findFirst.mockResolvedValue(null);
      cliente.cupon.create.mockResolvedValue({ id: 'c1', codigo: 'BIENVE-XXXXX' });
      await service.crearDesdePlantilla(
        { plantilla: 'bienvenida_vip' } as never,
        ctx,
        'usr-1',
      );
      const data = cliente.cupon.create.mock.calls[0][0].data;
      expect(data.tipoDescuento).toBe('porcentaje');
      expect(Number(data.valorDescuento.toString())).toBe(30);
      expect(data.segmento).toBe('vip_a');
      expect(data.plantilla).toBe('bienvenida_vip');
      expect(data.disenoEmoji).toBe('👑');
      expect(data.creadoPorId).toBe('usr-1');
    });
  });

  // ─── ELIMINAR (soft) ────────────────────────────────────────────────

  describe('eliminar', () => {
    it('soft delete: setea eliminadoEn', async () => {
      cliente.cupon.findFirst.mockResolvedValue({ id: 'c1' });
      cliente.cupon.update.mockResolvedValue({ id: 'c1' });
      await service.eliminar('c1', ctx);
      const arg = cliente.cupon.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'c1' });
      expect(arg.data.eliminadoEn).toBeInstanceOf(Date);
    });
  });

  // ─── ESTADÍSTICAS ────────────────────────────────────────────────────

  describe('estadisticas', () => {
    it('calcula ROI cuando hay descuento entregado', async () => {
      cliente.cupon.findFirst.mockResolvedValue({ id: 'c1', usosMaximosTotal: 100 });
      cliente.cuponUso.count.mockResolvedValue(25);
      cliente.cuponUso.aggregate
        .mockResolvedValueOnce({
          _sum: { montoDescuento: new Prisma.Decimal('500'), montoVenta: new Prisma.Decimal('2500') },
        })
        .mockResolvedValueOnce({ _sum: { montoVenta: new Prisma.Decimal('2500') } });
      cliente.cuponUso.groupBy.mockResolvedValue([{ clienteId: 'a' }, { clienteId: 'b' }]);
      const stats = await service.estadisticas('c1', ctx);
      expect(stats.usos).toBe(25);
      expect(stats.descuentoEntregado).toBe('500.00');
      expect(stats.ventasGeneradas).toBe('2500.00');
      expect(stats.ingresoNeto).toBe('2000.00');
      expect(stats.roi).toBe(4); // (2500-500)/500
      expect(stats.clientesUnicos).toBe(2);
      expect(stats.tasaCanje).toBe(25);
    });

    it('ROI null cuando no hay descuento entregado', async () => {
      cliente.cupon.findFirst.mockResolvedValue({ id: 'c1', usosMaximosTotal: null });
      cliente.cuponUso.count.mockResolvedValue(0);
      cliente.cuponUso.aggregate
        .mockResolvedValueOnce({ _sum: { montoDescuento: null, montoVenta: null } })
        .mockResolvedValueOnce({ _sum: { montoVenta: null } });
      cliente.cuponUso.groupBy.mockResolvedValue([]);
      const stats = await service.estadisticas('c1', ctx);
      expect(stats.roi).toBeNull();
      expect(stats.tasaCanje).toBeNull();
    });
  });

  // ─── VALIDAR ─────────────────────────────────────────────────────────

  describe('validar', () => {
    it('rechaza si el código no existe', async () => {
      cliente.cupon.findFirst.mockResolvedValue(null);
      const res = await service.validar(
        { codigo: 'X', items: [{ varianteId: 'v', cantidad: 1, precioUnitario: 100 }] } as never,
        ctx,
      );
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/no existe/i);
    });

    it('enriquece items sin productoId desde la DB', async () => {
      cliente.cupon.findFirst.mockResolvedValue({
        id: 'c1',
        codigo: 'TEST',
        estado: 'activo',
        eliminadoEn: null,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2027-01-01'),
        tipoDescuento: 'porcentaje',
        valorDescuento: new Prisma.Decimal('20'),
        montoMinimoCompra: null,
        descuentoMaximo: null,
        usosMaximosTotal: null,
        usosMaximosPorCliente: 1,
        segmento: 'todos',
        clientesElegiblesIds: [],
        aplicableA: 'toda_compra',
        categoriasAplicablesIds: [],
        productosAplicablesIds: [],
      });
      cliente.cuponUso.count.mockResolvedValue(0);
      cliente.variante.findUnique.mockResolvedValue({
        producto: { id: 'p1', categoriaId: 'cat1' },
      });
      const res = await service.validar(
        { codigo: 'TEST', items: [{ varianteId: 'v1', cantidad: 1, precioUnitario: 100 }] } as never,
        ctx,
      );
      expect(cliente.variante.findUnique).toHaveBeenCalled();
      expect(res.valido).toBe(true);
      expect(res.descuento).toBe(20);
    });

    it('rechaza por segmento nuevos_clientes si cliente tiene compras previas', async () => {
      cliente.cupon.findFirst.mockResolvedValue({
        id: 'c1',
        codigo: 'NEW',
        estado: 'activo',
        eliminadoEn: null,
        fechaInicio: new Date('2026-01-01'),
        fechaFin: new Date('2027-01-01'),
        tipoDescuento: 'porcentaje',
        valorDescuento: new Prisma.Decimal('10'),
        segmento: 'nuevos_clientes',
        clientesElegiblesIds: [],
        aplicableA: 'toda_compra',
        categoriasAplicablesIds: [],
        productosAplicablesIds: [],
        montoMinimoCompra: null,
        descuentoMaximo: null,
        usosMaximosTotal: null,
        usosMaximosPorCliente: 1,
      });
      cliente.cuponUso.count.mockResolvedValue(0);
      cliente.cliente.findFirst.mockResolvedValue({
        clasificacion: 'A',
        totalCompras: new Prisma.Decimal('500'),
        ultimaCompraEn: new Date(),
      });
      const res = await service.validar(
        {
          codigo: 'NEW',
          clienteId: 'cliente-x',
          items: [{ varianteId: 'v', productoId: 'p', categoriaId: 'c', cantidad: 1, precioUnitario: 100 }],
        } as never,
        ctx,
      );
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/nuevos clientes/i);
    });

    it('rechaza por reactivación si cliente compró hace <60 días', async () => {
      cliente.cupon.findFirst.mockResolvedValue({
        id: 'c1', codigo: 'RE',
        estado: 'activo', eliminadoEn: null,
        fechaInicio: new Date('2026-01-01'), fechaFin: new Date('2027-01-01'),
        tipoDescuento: 'porcentaje', valorDescuento: new Prisma.Decimal('25'),
        segmento: 'reactivacion',
        clientesElegiblesIds: [],
        aplicableA: 'toda_compra',
        categoriasAplicablesIds: [], productosAplicablesIds: [],
        montoMinimoCompra: null, descuentoMaximo: null,
        usosMaximosTotal: null, usosMaximosPorCliente: 1,
      });
      cliente.cuponUso.count.mockResolvedValue(0);
      cliente.cliente.findFirst.mockResolvedValue({
        clasificacion: 'B',
        totalCompras: new Prisma.Decimal('100'),
        ultimaCompraEn: new Date(Date.now() - 10 * 86400_000), // 10 días atrás
      });
      const res = await service.validar(
        {
          codigo: 'RE',
          clienteId: 'cliente-x',
          items: [{ varianteId: 'v', productoId: 'p', categoriaId: 'c', cantidad: 1, precioUnitario: 100 }],
        } as never,
        ctx,
      );
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/60\+ d[ií]as|reactivaci[oó]n/i);
    });
  });
});
