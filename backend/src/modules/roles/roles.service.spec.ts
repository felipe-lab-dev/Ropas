import { Test } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorConflicto, ErrorValidacion } from '../../core/errors/errores';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function crearClienteMock() {
  const rol: Mocked<{ findMany: unknown; findFirst: unknown; create: unknown; update: unknown }> = {
    findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(),
  };
  const usuario: Mocked<{ count: unknown }> = { count: jest.fn() };
  return { rol, usuario };
}

const ctx = { codigo: 'mi-tienda', schemaName: 'tenant_mitienda' } as unknown as TenantContext;

describe('RolesService', () => {
  let service: RolesService;
  let cliente: ReturnType<typeof crearClienteMock>;
  let prisma: { forTenant: jest.Mock };

  beforeEach(async () => {
    cliente = crearClienteMock();
    prisma = { forTenant: jest.fn().mockReturnValue(cliente) };
    const mod = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaTenantService, useValue: prisma }],
    }).compile();
    service = mod.get(RolesService);
  });

  describe('crear', () => {
    it('rechaza permisos que no existen en el catálogo', async () => {
      await expect(
        service.crear({ nombre: 'X', permisos: ['ventas:crear', 'inventado:hacer'] } as never, ctx),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('rechaza el wildcard *', async () => {
      await expect(
        service.crear({ nombre: 'X', permisos: ['*'] } as never, ctx),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('lanza ErrorConflicto si el nombre ya existe', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r9' });
      await expect(
        service.crear({ nombre: 'Vendedor', permisos: ['ventas:crear'] } as never, ctx),
      ).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('crea con permisos deduplicados y esSistema=false', async () => {
      cliente.rol.findFirst.mockResolvedValue(null);
      cliente.rol.create.mockResolvedValue({ id: 'r1' });
      await service.crear({ nombre: 'Vendedor', permisos: ['ventas:crear', 'ventas:crear', 'ventas:leer'] } as never, ctx);
      const data = cliente.rol.create.mock.calls[0][0].data;
      expect(data.permisos).toEqual(['ventas:crear', 'ventas:leer']);
      expect(data.esSistema).toBe(false);
    });
  });

  describe('actualizar', () => {
    it('bloquea editar un rol del sistema', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r1', nombre: 'Administrador', esSistema: true, permisos: ['*'] });
      await expect(
        service.actualizar('r1', { permisos: ['ventas:leer'] } as never, ctx),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('actualiza permisos de un rol normal', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r2', nombre: 'Vendedor', esSistema: false, permisos: [] });
      cliente.rol.update.mockResolvedValue({ id: 'r2' });
      await service.actualizar('r2', { permisos: ['ventas:leer', 'ventas:crear'] } as never, ctx);
      expect(cliente.rol.update.mock.calls[0][0].data.permisos).toEqual(['ventas:leer', 'ventas:crear']);
    });
  });

  describe('eliminar', () => {
    it('bloquea eliminar rol del sistema', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r1', esSistema: true, permisos: ['*'] });
      await expect(service.eliminar('r1', ctx)).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('bloquea eliminar rol con usuarios asignados', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r2', esSistema: false, permisos: [] });
      cliente.usuario.count.mockResolvedValue(3);
      await expect(service.eliminar('r2', ctx)).rejects.toBeInstanceOf(ErrorValidacion);
      expect(cliente.rol.update).not.toHaveBeenCalled();
    });

    it('soft delete cuando no hay usuarios', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r2', esSistema: false, permisos: [] });
      cliente.usuario.count.mockResolvedValue(0);
      cliente.rol.update.mockResolvedValue({ id: 'r2' });
      await service.eliminar('r2', ctx);
      expect(cliente.rol.update.mock.calls[0][0].data.eliminadoEn).toBeInstanceOf(Date);
    });
  });
});
