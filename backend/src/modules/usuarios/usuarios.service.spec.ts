import { Test } from '@nestjs/testing';
import { UsuariosService } from './usuarios.service';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (p: string) => `hashed:${p}`),
  compare: jest.fn(),
}));

type Mocked<T> = { [K in keyof T]: jest.Mock };

function crearClienteMock() {
  const usuario: Mocked<{ findMany: unknown; findFirst: unknown; count: unknown; create: unknown; update: unknown }> = {
    findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(),
  };
  const rol: Mocked<{ findFirst: unknown }> = { findFirst: jest.fn() };
  return { usuario, rol };
}

const ctx = { codigo: 'mi-tienda', schemaName: 'tenant_mitienda' } as unknown as TenantContext;

describe('UsuariosService', () => {
  let service: UsuariosService;
  let cliente: ReturnType<typeof crearClienteMock>;
  let prisma: { forTenant: jest.Mock };

  beforeEach(async () => {
    cliente = crearClienteMock();
    prisma = { forTenant: jest.fn().mockReturnValue(cliente) };
    const mod = await Test.createTestingModule({
      providers: [UsuariosService, { provide: PrismaTenantService, useValue: prisma }],
    }).compile();
    service = mod.get(UsuariosService);
  });

  describe('listar', () => {
    it('filtra eliminadoEn:null y nunca expone passwordHash', async () => {
      cliente.usuario.findMany.mockResolvedValue([
        { id: 'u1', nombre: 'A', email: 'a@x.com', passwordHash: 'secreto', rol: { id: 'r1', nombre: 'Admin' } },
      ]);
      cliente.usuario.count.mockResolvedValue(1);
      const res = await service.listar({ pagina: 1, limite: 30, orden: 'desc' } as never, ctx);
      expect(cliente.usuario.findMany.mock.calls[0][0].where).toEqual({ eliminadoEn: null });
      expect(res.datos[0]).not.toHaveProperty('passwordHash');
      expect(res.total).toBe(1);
    });
  });

  describe('crear', () => {
    const dto = { nombre: 'Juan Perez', email: 'juan@x.com', dni: '12345678', rolId: 'r1' };

    it('lanza ErrorValidacion si el rol no existe', async () => {
      cliente.rol.findFirst.mockResolvedValue(null);
      await expect(service.crear(dto as never, ctx)).rejects.toBeInstanceOf(ErrorValidacion);
      expect(cliente.usuario.create).not.toHaveBeenCalled();
    });

    it('lanza ErrorConflicto si el email ya existe', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r1' });
      cliente.usuario.findFirst.mockResolvedValueOnce({ id: 'dup' }); // email dup
      await expect(service.crear(dto as never, ctx)).rejects.toBeInstanceOf(ErrorConflicto);
    });

    it('usa el DNI como contraseña inicial si no se envía password (y la hashea)', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r1' });
      cliente.usuario.findFirst.mockResolvedValue(null);
      cliente.usuario.create.mockResolvedValue({ id: 'u1', passwordHash: 'hashed:12345678', rol: { id: 'r1', nombre: 'Admin' } });
      await service.crear(dto as never, ctx);
      const data = cliente.usuario.create.mock.calls[0][0].data;
      expect(data.passwordHash).toBe('hashed:12345678');
      expect(data).not.toHaveProperty('password');
    });

    it('exige password o DNI', async () => {
      cliente.rol.findFirst.mockResolvedValue({ id: 'r1' });
      cliente.usuario.findFirst.mockResolvedValue(null);
      await expect(
        service.crear({ nombre: 'Sin Doc', email: 's@x.com', rolId: 'r1' } as never, ctx),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });
  });

  describe('actualizar', () => {
    it('bloquea desactivar el propio usuario', async () => {
      cliente.usuario.findFirst.mockResolvedValue({ id: 'u1', email: 'a@x.com', rolId: 'r1' });
      await expect(
        service.actualizar('u1', { activo: false } as never, ctx, 'u1'),
      ).rejects.toBeInstanceOf(ErrorValidacion);
    });

    it('hashea solo si se envía password nueva', async () => {
      cliente.usuario.findFirst.mockResolvedValue({ id: 'u1', email: 'a@x.com', dni: null, rolId: 'r1' });
      cliente.usuario.update.mockResolvedValue({ id: 'u1', passwordHash: 'hashed:nueva123', rol: { id: 'r1', nombre: 'X' } });
      await service.actualizar('u1', { password: 'nueva123' } as never, ctx, 'otro');
      expect(cliente.usuario.update.mock.calls[0][0].data.passwordHash).toBe('hashed:nueva123');
    });
  });

  describe('eliminar', () => {
    it('bloquea eliminar el propio usuario', async () => {
      await expect(service.eliminar('u1', ctx, 'u1')).rejects.toBeInstanceOf(ErrorValidacion);
      expect(cliente.usuario.update).not.toHaveBeenCalled();
    });

    it('soft delete (eliminadoEn + activo:false)', async () => {
      cliente.usuario.findFirst.mockResolvedValue({ id: 'u1' });
      cliente.usuario.update.mockResolvedValue({ id: 'u1' });
      await service.eliminar('u1', ctx, 'admin');
      const data = cliente.usuario.update.mock.calls[0][0].data;
      expect(data.activo).toBe(false);
      expect(data.eliminadoEn).toBeInstanceOf(Date);
    });

    it('lanza ErrorNoEncontrado si no existe', async () => {
      cliente.usuario.findFirst.mockResolvedValue(null);
      await expect(service.eliminar('xxx', ctx, 'admin')).rejects.toBeInstanceOf(ErrorNoEncontrado);
    });
  });
});
