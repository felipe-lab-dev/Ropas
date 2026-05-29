import { Test } from '@nestjs/testing';
import { BrandingService } from './branding.service';
import { PrismaPublicService } from '../../core/prisma/prisma-public.service';
import { ErrorNoEncontrado, ErrorValidacion } from '../../core/errors/errores';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function crearTenantMock(): Mocked<{
  findFirst: unknown;
  findMany: unknown;
  update: unknown;
}> {
  return {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  };
}

const SVG = '<svg viewBox="0 0 100 100"><path d="M0 0h10v10H0z"/></svg>';

describe('BrandingService', () => {
  let service: BrandingService;
  let tenant: ReturnType<typeof crearTenantMock>;
  const envOriginal = process.env.NODE_ENV;

  beforeEach(async () => {
    tenant = crearTenantMock();
    const mod = await Test.createTestingModule({
      providers: [
        BrandingService,
        { provide: PrismaPublicService, useValue: { tenant } },
      ],
    }).compile();
    service = mod.get(BrandingService);
  });

  afterEach(() => {
    process.env.NODE_ENV = envOriginal;
  });

  // ---------- obtenerPublico ----------

  describe('obtenerPublico', () => {
    it('devuelve el branding cuando la tienda existe', async () => {
      tenant.findFirst.mockResolvedValue({
        codigo: 'loremstore',
        nombre: 'Lorem Store',
        branding: { logoSvg: SVG, nombre: 'Lorem!', subtitulo: 'Más rápido' },
      });

      const res = await service.obtenerPublico('loremstore');

      expect(res).toEqual({
        codigo: 'loremstore',
        nombre: 'Lorem!',
        subtitulo: 'Más rápido',
        logoSvg: SVG,
        tenantEncontrado: true,
      });
      expect(tenant.findFirst).toHaveBeenCalledWith({
        where: { codigo: 'loremstore', eliminadoEn: null },
      });
    });

    it('cae al nombre del tenant cuando branding.nombre es null', async () => {
      tenant.findFirst.mockResolvedValue({
        codigo: 'loremstore',
        nombre: 'Lorem Store',
        branding: null,
      });

      const res = await service.obtenerPublico('loremstore');

      expect(res.nombre).toBe('Lorem Store');
      expect(res.logoSvg).toBeNull();
      expect(res.tenantEncontrado).toBe(true);
    });

    it('marca tenantEncontrado=false cuando no existe la tienda', async () => {
      tenant.findFirst.mockResolvedValue(null);

      const res = await service.obtenerPublico('inexistente');

      expect(res).toEqual({
        codigo: 'inexistente',
        nombre: 'inexistente',
        subtitulo: null,
        logoSvg: null,
        tenantEncontrado: false,
      });
    });
  });

  // ---------- listarTiendas ----------

  describe('listarTiendas', () => {
    it('lista tiendas activas/trial fuera de producción', async () => {
      process.env.NODE_ENV = 'development';
      tenant.findMany.mockResolvedValue([{ codigo: 'loremstore', nombre: 'Lorem Store' }]);

      const res = await service.listarTiendas();

      expect(res).toEqual([{ codigo: 'loremstore', nombre: 'Lorem Store' }]);
      expect(tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eliminadoEn: null }),
          select: { codigo: true, nombre: true },
        }),
      );
    });

    it('devuelve [] en producción sin consultar la DB', async () => {
      process.env.NODE_ENV = 'production';

      const res = await service.listarTiendas();

      expect(res).toEqual([]);
      expect(tenant.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------- actualizar ----------

  describe('actualizar', () => {
    it('hace merge defensivo: solo pisa las claves provistas', async () => {
      tenant.findFirst.mockResolvedValue({
        codigo: 'loremstore',
        nombre: 'Lorem Store',
        branding: { logoSvg: SVG, nombre: 'Viejo', subtitulo: 'Viejo sub' },
      });
      tenant.update.mockResolvedValue({});

      await service.actualizar('loremstore', { nombre: 'Nuevo' });

      expect(tenant.update).toHaveBeenCalledWith({
        where: { codigo: 'loremstore' },
        data: { branding: { logoSvg: SVG, nombre: 'Nuevo', subtitulo: 'Viejo sub' } },
      });
    });

    it('rechaza un logoSvg que no parece SVG', async () => {
      await expect(
        service.actualizar('loremstore', { logoSvg: 'no soy svg' }),
      ).rejects.toBeInstanceOf(ErrorValidacion);
      expect(tenant.update).not.toHaveBeenCalled();
    });

    it('lanza ErrorNoEncontrado si la tienda no existe', async () => {
      tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.actualizar('inexistente', { nombre: 'X' }),
      ).rejects.toBeInstanceOf(ErrorNoEncontrado);
      expect(tenant.update).not.toHaveBeenCalled();
    });
  });
});
