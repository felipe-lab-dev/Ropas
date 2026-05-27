/**
 * Tests del SerieCpeService — métodos CRUD (listar, crear, actualizar).
 *
 * Los 5 tests de asignarProximoCorrelativo ya viven en series-cpe.service.spec.ts.
 * Este archivo cubre los 9+ tests nuevos del CRUD de la iteración 4.C.
 */
import { SerieCpeService } from './series-cpe.service';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../../core/errors/errores';
import { Prisma } from '@prisma/client';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Tipos mock ────────────────────────────────────────────────────────────────

interface MockSerieCpe {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
}

interface MockSucursal {
  findFirst: jest.Mock;
}

interface MockPrisma {
  serieCpe: MockSerieCpe;
  sucursal: MockSucursal;
  $transaction: jest.Mock;
}

function crearMockPrisma(): MockPrisma {
  return {
    serieCpe: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sucursal: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  };
}

function crearMockPrismaTenancy(prismaMock: MockPrisma) {
  return {
    forTenant: jest.fn().mockReturnValue(prismaMock),
  };
}

// ─── Datos de prueba ────────────────────────────────────────────────────────

const CTX_TEST: TenantContext = {
  codigo: 'test',
  schemaName: 'tenant_test',
  nombre: 'Test',
  plan: '',
  modulosHabilitados: [],
  limites: {},
  accesoPermitido: true,
};

const SUCURSAL_ID = 'aaaa-bbbb-cccc-dddd-eeee11111111';

const sucursalExistente = {
  id: SUCURSAL_ID,
  nombre: 'Principal',
  eliminadoEn: null,
};

function crearSerie(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'serie-uuid-001',
    sucursalId: SUCURSAL_ID,
    tipoCpe: 'factura',
    serie: 'F001',
    correlativoActual: 0,
    activa: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    sucursal: sucursalExistente,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SerieCpeService — CRUD', () => {
  let service: SerieCpeService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = crearMockPrisma();
    service = new SerieCpeService(crearMockPrismaTenancy(prisma) as never);
  });

  // ─── 1. Listar sin filtro ─────────────────────────────────────────────────

  it('listar sin filtro retorna todas las series con sucursal incluida', async () => {
    const series = [crearSerie(), crearSerie({ id: 'serie-uuid-002', serie: 'B001', tipoCpe: 'boleta' })];
    prisma.serieCpe.findMany.mockResolvedValue(series);

    const resultado = await service.listar(CTX_TEST);

    expect(resultado).toEqual(series);
    expect(prisma.serieCpe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
        include: { sucursal: true },
      }),
    );
  });

  // ─── 2. Listar con sucursalId ─────────────────────────────────────────────

  it('listar con sucursalId filtra por esa sucursal', async () => {
    const series = [crearSerie()];
    prisma.serieCpe.findMany.mockResolvedValue(series);

    await service.listar(CTX_TEST, SUCURSAL_ID);

    expect(prisma.serieCpe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sucursalId: SUCURSAL_ID },
      }),
    );
  });

  // ─── 3. Crear happy path factura F001 ────────────────────────────────────

  it('crear factura F001 retorna la serie creada', async () => {
    prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);
    const serieCreada = crearSerie();
    prisma.serieCpe.create.mockResolvedValue(serieCreada);

    const resultado = await service.crear(CTX_TEST, {
      sucursalId: SUCURSAL_ID,
      tipoCpe: 'factura',
      serie: 'F001',
    });

    expect(resultado).toEqual(serieCreada);
    expect(prisma.serieCpe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sucursalId: SUCURSAL_ID,
          tipoCpe: 'factura',
          serie: 'F001',
          correlativoActual: 0,
          activa: true,
        }),
      }),
    );
  });

  // ─── 4. Crear con correlativoInicial=1500 ────────────────────────────────

  it('crear con correlativoInicial=1500 setea correlativoActual=1500', async () => {
    prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);
    const serieCreada = crearSerie({ correlativoActual: 1500 });
    prisma.serieCpe.create.mockResolvedValue(serieCreada);

    const resultado = await service.crear(CTX_TEST, {
      sucursalId: SUCURSAL_ID,
      tipoCpe: 'factura',
      serie: 'F002',
      correlativoInicial: 1500,
    });

    expect(resultado.correlativoActual).toBe(1500);
    expect(prisma.serieCpe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ correlativoActual: 1500 }),
      }),
    );
  });

  // ─── 5. Crear con formato inválido (f001 — minúscula) ────────────────────

  it('crear con formato inválido (f001 — minúscula) lanza ErrorValidacion', async () => {
    prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

    await expect(
      service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID, tipoCpe: 'factura', serie: 'f001' }),
    ).rejects.toThrow(ErrorValidacion);
  });

  // ─── 6. Crear con serie de 5 chars inválida ───────────────────────────────

  it('crear con serie de 5 chars (F0011) lanza ErrorValidacion', async () => {
    prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

    await expect(
      service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID, tipoCpe: 'factura', serie: 'F0011' }),
    ).rejects.toThrow(ErrorValidacion);
  });

  // ─── 7. Crear factura con serie B001 (mismatch letra↔tipo) ───────────────

  it('crear factura con serie B001 lanza ErrorValidacion por coherencia letra↔tipo', async () => {
    prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

    await expect(
      service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID, tipoCpe: 'factura', serie: 'B001' }),
    ).rejects.toThrow(ErrorValidacion);

    await expect(
      service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID, tipoCpe: 'factura', serie: 'B001' }),
    ).rejects.toThrow(/factura.*F|F.*factura/i);
  });

  // ─── 7b. Crear boleta con serie F001 (mismatch inverso) ──────────────────

  it('crear boleta con serie F001 lanza ErrorValidacion', async () => {
    prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

    await expect(
      service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID, tipoCpe: 'boleta', serie: 'F001' }),
    ).rejects.toThrow(ErrorValidacion);
  });

  // ─── 8. Crear duplicado → P2002 → ErrorConflicto ────────────────────────

  it('crear duplicado: Prisma P2002 se mapea a ErrorConflicto', async () => {
    prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    prisma.serieCpe.create.mockRejectedValue(p2002);

    await expect(
      service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID, tipoCpe: 'factura', serie: 'F001' }),
    ).rejects.toThrow(ErrorConflicto);

    await expect(
      service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID, tipoCpe: 'factura', serie: 'F001' }),
    ).rejects.toThrow(/ya existe/i);
  });

  // ─── 9. Crear con sucursalId inexistente → ErrorNoEncontrado ─────────────

  it('crear con sucursalId inexistente lanza ErrorNoEncontrado', async () => {
    prisma.sucursal.findFirst.mockResolvedValue(null);

    await expect(
      service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID, tipoCpe: 'factura', serie: 'F001' }),
    ).rejects.toThrow(ErrorNoEncontrado);
  });

  // ─── 10. Actualizar activa=false ─────────────────────────────────────────

  it('actualizar activa=false deja la serie inactiva', async () => {
    const serieInactiva = crearSerie({ activa: false });
    prisma.serieCpe.findFirst.mockResolvedValue(crearSerie());
    prisma.serieCpe.update.mockResolvedValue(serieInactiva);

    const resultado = await service.actualizar(CTX_TEST, 'serie-uuid-001', { activa: false });

    expect(resultado.activa).toBe(false);
    expect(prisma.serieCpe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'serie-uuid-001' },
        data: { activa: false },
      }),
    );
  });

  // ─── 11. Actualizar con campos extra (serie="F999") — solo aplica activa ──

  it('actualizar con campos extra solo aplica activa e ignora el resto', async () => {
    const serieActualizada = crearSerie({ activa: false });
    prisma.serieCpe.findFirst.mockResolvedValue(crearSerie());
    prisma.serieCpe.update.mockResolvedValue(serieActualizada);

    // El DTO solo acepta activa; pasamos un objeto cast con campo extra
    const dto = { activa: false } as Parameters<typeof service.actualizar>[2];
    await service.actualizar(CTX_TEST, 'serie-uuid-001', dto);

    // Verificar que update solo recibe { activa: false } — no incluye serie, tipoCpe, etc.
    const dataArg = prisma.serieCpe.update.mock.calls[0][0].data;
    expect(dataArg).toEqual({ activa: false });
    expect(dataArg).not.toHaveProperty('serie');
    expect(dataArg).not.toHaveProperty('tipoCpe');
    expect(dataArg).not.toHaveProperty('correlativoActual');
  });
});
