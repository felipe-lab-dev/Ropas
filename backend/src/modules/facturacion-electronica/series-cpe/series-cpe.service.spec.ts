/**
 * Tests de SerieCpeService — asignación atómica de correlativos.
 *
 * Mockeamos prismaTenancy.forTenant() que retorna un mock de PrismaClient.
 * El tipo MockPrisma es local; no importamos PrismaClient de @prisma/client.
 */
import { SerieCpeService } from './series-cpe.service';
import { ErrorNoEncontrado } from '../../../core/errors/errores';
import type { TipoCpe } from '../../../core/sunat/codigos';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Mock types ──────────────────────────────────────────────────────────────

interface MockSerieCpe {
  findFirst: jest.Mock;
  update: jest.Mock;
}

interface MockPrisma {
  $transaction: jest.Mock;
  serieCpe: MockSerieCpe;
}

function crearMockPrisma(): MockPrisma {
  const serieCpe: MockSerieCpe = {
    findFirst: jest.fn(),
    update: jest.fn(),
  };

  // $transaction(fn) ejecuta fn(tx) sincrónicamente en tests.
  // tx expone el mismo serieCpe para verificar las llamadas.
  const prisma: MockPrisma = {
    serieCpe,
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ serieCpe });
    }),
  };

  return prisma;
}

function crearMockPrismaTenancy(prismaMock: MockPrisma) {
  return {
    forTenant: jest.fn().mockReturnValue(prismaMock),
  };
}

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const CTX_TEST: TenantContext = {
  codigo: 'test',
  schemaName: 'tenant_test',
  nombre: 'Test',
  plan: '',
  modulosHabilitados: [],
  limites: {},
  accesoPermitido: true,
};

const SUCURSAL_ID = 'sucursal-uuid-001';
const TIPO_CPE: TipoCpe = 'factura';

const serieBase = {
  id: 'serie-uuid-001',
  sucursalId: SUCURSAL_ID,
  tipoCpe: TIPO_CPE,
  serie: 'F001',
  correlativoActual: 31,
  activa: true,
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('SerieCpeService', () => {
  let service: SerieCpeService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = crearMockPrisma();
    service = new SerieCpeService(crearMockPrismaTenancy(prisma) as never);
  });

  // ─── 1. Happy path ────────────────────────────────────────────────────────

  it('retorna correlativo "00000032" cuando correlativoActual era 31', async () => {
    prisma.serieCpe.findFirst.mockResolvedValue(serieBase);
    prisma.serieCpe.update.mockResolvedValue({ ...serieBase, correlativoActual: 32 });

    const resultado = await service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, TIPO_CPE);

    expect(resultado).toEqual({
      serieCpeId: 'serie-uuid-001',
      serie: 'F001',
      correlativo: '00000032',
    });
  });

  // ─── 2. Sin serie activa ──────────────────────────────────────────────────

  it('lanza ErrorNoEncontrado con mensaje útil cuando no hay serie activa', async () => {
    prisma.serieCpe.findFirst.mockResolvedValue(null);

    await expect(
      service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, TIPO_CPE),
    ).rejects.toThrow(ErrorNoEncontrado);

    await expect(
      service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, TIPO_CPE),
    ).rejects.toThrow(/sucursal.*factura|factura.*sucursal/i);
  });

  // ─── 3. Concurrencia — verifica increment:1 (no valor calculado app-side) ─

  it('llama update con { increment: 1 } para garantizar atomicidad en Postgres', async () => {
    prisma.serieCpe.findFirst.mockResolvedValue(serieBase);
    prisma.serieCpe.update.mockResolvedValue({ ...serieBase, correlativoActual: 32 });

    await service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, TIPO_CPE);

    expect(prisma.serieCpe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'serie-uuid-001' },
        data: { correlativoActual: { increment: 1 } },
      }),
    );
  });

  // ─── 4. Padding — correlativoActual=999 → "00001000" ─────────────────────

  it('retorna "00001000" cuando el nuevo correlativo es 1000', async () => {
    prisma.serieCpe.findFirst.mockResolvedValue({ ...serieBase, correlativoActual: 999 });
    prisma.serieCpe.update.mockResolvedValue({ ...serieBase, correlativoActual: 1000 });

    const resultado = await service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, TIPO_CPE);

    expect(resultado.correlativo).toBe('00001000');
  });

  // ─── 5. Tipos — where incluye tipoCpe ────────────────────────────────────

  it('incluye tipoCpe en el where de findFirst', async () => {
    const tipoBoleta: TipoCpe = 'boleta';
    prisma.serieCpe.findFirst.mockResolvedValue({
      ...serieBase,
      tipoCpe: tipoBoleta,
      serie: 'B001',
    });
    prisma.serieCpe.update.mockResolvedValue({
      ...serieBase,
      tipoCpe: tipoBoleta,
      serie: 'B001',
      correlativoActual: 1,
    });

    await service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, tipoBoleta);

    expect(prisma.serieCpe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipoCpe: tipoBoleta }),
      }),
    );
  });
});
