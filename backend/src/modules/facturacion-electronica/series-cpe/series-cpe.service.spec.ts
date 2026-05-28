/**
 * Tests de SerieCpeService — asignación atómica de correlativos y CRUD.
 *
 * Mockeamos prismaTenancy.forTenant() que retorna un mock de PrismaClient.
 * El tipo MockPrisma es local; no importamos PrismaClient de @prisma/client.
 */
import { SerieCpeService } from './series-cpe.service';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../../core/errors/errores';
import { Prisma } from '@prisma/client';
import type { TipoCpe } from '../../../core/sunat/codigos';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Mock types ──────────────────────────────────────────────────────────────

interface MockSerieCpe {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
}

interface MockDocumentoElectronico {
  count: jest.Mock;
}

interface MockSucursal {
  findFirst: jest.Mock;
}

interface MockPrisma {
  $transaction: jest.Mock;
  serieCpe: MockSerieCpe;
  documentoElectronico: MockDocumentoElectronico;
  sucursal: MockSucursal;
}

function crearMockPrisma(): MockPrisma {
  const serieCpe: MockSerieCpe = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  // $transaction(fn) ejecuta fn(tx) sincrónicamente en tests.
  // tx expone el mismo serieCpe para verificar las llamadas.
  const prisma: MockPrisma = {
    serieCpe,
    documentoElectronico: {
      count: jest.fn().mockResolvedValue(0),
    },
    sucursal: {
      findFirst: jest.fn(),
    },
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
};

// ─── Datos de prueba para CRUD ───────────────────────────────────────────────

const SUCURSAL_ID_CRUD = 'aaaa-bbbb-cccc-dddd-eeee11111111';

const sucursalExistente = {
  id: SUCURSAL_ID_CRUD,
  nombre: 'Principal',
  eliminadoEn: null,
};

function crearSerie(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'serie-uuid-001',
    sucursalId: SUCURSAL_ID_CRUD,
    tipoCpe: 'factura',
    serie: 'F001',
    correlativoActual: 0,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    sucursal: sucursalExistente,
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('SerieCpeService', () => {
  let service: SerieCpeService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = crearMockPrisma();
    service = new SerieCpeService(crearMockPrismaTenancy(prisma) as never);
  });

  // ─── asignarProximoCorrelativo ────────────────────────────────────────────

  describe('asignarProximoCorrelativo', () => {
    // ─── 1. Happy path ──────────────────────────────────────────────────────

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

    // ─── 2. Sin serie activa ────────────────────────────────────────────────

    it('lanza ErrorNoEncontrado con mensaje útil cuando no hay serie activa', async () => {
      prisma.serieCpe.findFirst.mockResolvedValue(null);

      await expect(
        service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, TIPO_CPE),
      ).rejects.toThrow(ErrorNoEncontrado);

      await expect(
        service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, TIPO_CPE),
      ).rejects.toThrow(/sucursal.*factura|factura.*sucursal/i);
    });

    // ─── 3. Concurrencia — verifica increment:1 (no valor calculado app-side)

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

    // ─── 4. Padding — correlativoActual=999 → "00001000" ───────────────────

    it('retorna "00001000" cuando el nuevo correlativo es 1000', async () => {
      prisma.serieCpe.findFirst.mockResolvedValue({ ...serieBase, correlativoActual: 999 });
      prisma.serieCpe.update.mockResolvedValue({ ...serieBase, correlativoActual: 1000 });

      const resultado = await service.asignarProximoCorrelativo(CTX_TEST, SUCURSAL_ID, TIPO_CPE);

      expect(resultado.correlativo).toBe('00001000');
    });

    // ─── 5. Tipos — where incluye tipoCpe ──────────────────────────────────

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

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  describe('CRUD', () => {
    // ─── 1. Listar sin filtro ───────────────────────────────────────────────

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

    // ─── 2. Listar con sucursalId ───────────────────────────────────────────

    it('listar con sucursalId filtra por esa sucursal', async () => {
      const series = [crearSerie()];
      prisma.serieCpe.findMany.mockResolvedValue(series);

      await service.listar(CTX_TEST, SUCURSAL_ID_CRUD);

      expect(prisma.serieCpe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sucursalId: SUCURSAL_ID_CRUD },
        }),
      );
    });

    // ─── 3. Crear happy path factura F001 ──────────────────────────────────

    it('crear factura F001 retorna la serie creada', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);
      const serieCreada = crearSerie();
      prisma.serieCpe.create.mockResolvedValue(serieCreada);

      const resultado = await service.crear(CTX_TEST, {
        sucursalId: SUCURSAL_ID_CRUD,
        tipoCpe: 'factura',
        serie: 'F001',
      });

      expect(resultado).toEqual(serieCreada);
      expect(prisma.serieCpe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sucursalId: SUCURSAL_ID_CRUD,
            tipoCpe: 'factura',
            serie: 'F001',
            correlativoActual: 0,
          }),
        }),
      );
    });

    // ─── 4. Crear con correlativoInicial=1500 ──────────────────────────────

    it('crear con correlativoInicial=1500 setea correlativoActual=1500', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);
      const serieCreada = crearSerie({ correlativoActual: 1500 });
      prisma.serieCpe.create.mockResolvedValue(serieCreada);

      const resultado = await service.crear(CTX_TEST, {
        sucursalId: SUCURSAL_ID_CRUD,
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

    // ─── 5. Crear con formato inválido (f001 — minúscula) ──────────────────

    it('crear con formato inválido (f001 — minúscula) lanza ErrorValidacion', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

      await expect(
        service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID_CRUD, tipoCpe: 'factura', serie: 'f001' }),
      ).rejects.toThrow(ErrorValidacion);
    });

    // ─── 6. Crear con serie de 5 chars inválida ────────────────────────────

    it('crear con serie de 5 chars (F0011) lanza ErrorValidacion', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

      await expect(
        service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID_CRUD, tipoCpe: 'factura', serie: 'F0011' }),
      ).rejects.toThrow(ErrorValidacion);
    });

    // ─── 7. Crear factura con serie B001 (mismatch letra↔tipo) ────────────

    it('crear factura con serie B001 lanza ErrorValidacion por coherencia letra↔tipo', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

      await expect(
        service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID_CRUD, tipoCpe: 'factura', serie: 'B001' }),
      ).rejects.toThrow(ErrorValidacion);

      await expect(
        service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID_CRUD, tipoCpe: 'factura', serie: 'B001' }),
      ).rejects.toThrow(/factura.*F|F.*factura/i);
    });

    // ─── 7b. Crear boleta con serie F001 (mismatch inverso) ───────────────

    it('crear boleta con serie F001 lanza ErrorValidacion', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

      await expect(
        service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID_CRUD, tipoCpe: 'boleta', serie: 'F001' }),
      ).rejects.toThrow(ErrorValidacion);
    });

    // ─── 8. Crear duplicado → P2002 → ErrorConflicto ──────────────────────

    it('crear duplicado: Prisma P2002 se mapea a ErrorConflicto', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);

      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      prisma.serieCpe.create.mockRejectedValue(p2002);

      await expect(
        service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID_CRUD, tipoCpe: 'factura', serie: 'F001' }),
      ).rejects.toThrow(ErrorConflicto);

      await expect(
        service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID_CRUD, tipoCpe: 'factura', serie: 'F001' }),
      ).rejects.toThrow(/ya existe/i);
    });

    // ─── 9. Crear con sucursalId inexistente → ErrorNoEncontrado ──────────

    it('crear con sucursalId inexistente lanza ErrorNoEncontrado', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(null);

      await expect(
        service.crear(CTX_TEST, { sucursalId: SUCURSAL_ID_CRUD, tipoCpe: 'factura', serie: 'F001' }),
      ).rejects.toThrow(ErrorNoEncontrado);
    });

    // ─── 9b. Crear sin sucursalId → resuelve sucursal principal ──────────

    it('crear sin sucursalId resuelve la sucursal principal automáticamente', async () => {
      prisma.sucursal.findFirst.mockResolvedValue({ ...sucursalExistente, esPrincipal: true });
      const serieCreada = crearSerie();
      prisma.serieCpe.create.mockResolvedValue(serieCreada);

      const resultado = await service.crear(CTX_TEST, {
        tipoCpe: 'factura',
        serie: 'F001',
      });

      expect(resultado).toEqual(serieCreada);
      // Debe haber buscado la sucursal principal (esPrincipal: true, sin id explícito)
      expect(prisma.sucursal.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ esPrincipal: true, eliminadoEn: null }),
        }),
      );
      // El create debe usar el id resuelto de la sucursal principal
      expect(prisma.serieCpe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sucursalId: sucursalExistente.id }),
        }),
      );
    });

    // ─── 9c. Crear sin sucursalId y sin sucursal principal → ErrorNoEncontrado

    it('crear sin sucursalId y sin sucursal principal lanza ErrorNoEncontrado', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(null);

      await expect(
        service.crear(CTX_TEST, { tipoCpe: 'factura', serie: 'F001' }),
      ).rejects.toThrow(ErrorNoEncontrado);

      await expect(
        service.crear(CTX_TEST, { tipoCpe: 'factura', serie: 'F001' }),
      ).rejects.toThrow(/sucursal principal/i);
    });

    // ─── 10. Unicidad TOTAL: crear duplicado lanza ErrorConflicto ──────────

    it('crear duplicado lanza ErrorConflicto cuando ya existe una serie del mismo tipo', async () => {
      prisma.sucursal.findFirst.mockResolvedValue(sucursalExistente);
      // Hay otra fila del mismo (sucursal, tipo, aplicaA)
      prisma.serieCpe.findFirst.mockResolvedValueOnce(crearSerie({ serie: 'F001' }));

      await expect(
        service.crear(CTX_TEST, {
          sucursalId: SUCURSAL_ID_CRUD,
          tipoCpe: 'factura',
          serie: 'F002',
        }),
      ).rejects.toThrow(ErrorConflicto);

      prisma.serieCpe.findFirst.mockResolvedValueOnce(crearSerie({ serie: 'F001' }));
      await expect(
        service.crear(CTX_TEST, {
          sucursalId: SUCURSAL_ID_CRUD,
          tipoCpe: 'factura',
          serie: 'F002',
        }),
      ).rejects.toThrow(/ya existe.*F001|una serie por tipo/i);
      expect(prisma.serieCpe.create).not.toHaveBeenCalled();
    });

    // ─── 11. Editar serie sin emisiones (happy path) ───────────────────────

    it('editar sin emisiones actualiza la serie con los campos pasados', async () => {
      const existente = crearSerie({ tipoCpe: 'factura', aplicaA: null, serie: 'F001', correlativoActual: 0 });
      const actualizada = crearSerie({ serie: 'F010', correlativoActual: 500 });
      prisma.serieCpe.findFirst.mockResolvedValueOnce(existente);
      prisma.documentoElectronico.count.mockResolvedValueOnce(0);
      prisma.serieCpe.update.mockResolvedValue(actualizada);

      const resultado = await service.editar(CTX_TEST, 'serie-uuid-001', {
        serie: 'F010',
        correlativoInicial: 500,
      });

      expect(resultado).toEqual(actualizada);
      expect(prisma.serieCpe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'serie-uuid-001' },
          data: expect.objectContaining({
            serie: 'F010',
            correlativoActual: 500,
          }),
        }),
      );
    });

    // ─── 12. Editar serie CON emisiones → bloqueo ──────────────────────────

    it('editar serie con comprobantes emitidos lanza ErrorConflicto', async () => {
      const existente = crearSerie({ serie: 'F001', correlativoActual: 12 });
      prisma.serieCpe.findFirst.mockResolvedValueOnce(existente);
      prisma.documentoElectronico.count.mockResolvedValueOnce(12);

      await expect(
        service.editar(CTX_TEST, 'serie-uuid-001', { serie: 'F002' }),
      ).rejects.toThrow(ErrorConflicto);

      prisma.serieCpe.findFirst.mockResolvedValueOnce(existente);
      prisma.documentoElectronico.count.mockResolvedValueOnce(12);
      await expect(
        service.editar(CTX_TEST, 'serie-uuid-001', { serie: 'F002' }),
      ).rejects.toThrow(/12 comprobante|inmutables.*SUNAT/i);

      expect(prisma.serieCpe.update).not.toHaveBeenCalled();
    });

    // ─── 13. Editar cambiando categoría a una ya ocupada → conflicto ───────

    it('editar cambiando categoría a una ya ocupada por OTRA serie lanza ErrorConflicto', async () => {
      const existente = crearSerie({ tipoCpe: 'factura', aplicaA: null, serie: 'F001' });
      const otraSerie = crearSerie({ id: 'serie-uuid-002', tipoCpe: 'boleta', aplicaA: null, serie: 'B001' });
      prisma.serieCpe.findFirst
        .mockResolvedValueOnce(existente)   // lookup por id
        .mockResolvedValueOnce(otraSerie);  // lookup unicidad
      prisma.documentoElectronico.count.mockResolvedValueOnce(0);

      await expect(
        service.editar(CTX_TEST, 'serie-uuid-001', {
          tipoCpe: 'boleta',
          serie: 'B005',
        }),
      ).rejects.toThrow(ErrorConflicto);
      expect(prisma.serieCpe.update).not.toHaveBeenCalled();
    });

    // ─── 14. Editar con id inexistente → ErrorNoEncontrado ─────────────────

    it('editar con id inexistente lanza ErrorNoEncontrado', async () => {
      prisma.serieCpe.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.editar(CTX_TEST, 'serie-inexistente', { serie: 'F010' }),
      ).rejects.toThrow(ErrorNoEncontrado);
    });

    // ─── 15. Editar valida prefijo letra↔tipo ──────────────────────────────

    it('editar boleta con serie F010 lanza ErrorValidacion por prefijo incoherente', async () => {
      const existente = crearSerie({ tipoCpe: 'boleta', aplicaA: null, serie: 'B001' });
      prisma.serieCpe.findFirst.mockResolvedValueOnce(existente);
      prisma.documentoElectronico.count.mockResolvedValueOnce(0);

      await expect(
        service.editar(CTX_TEST, 'serie-uuid-001', { serie: 'F010' }),
      ).rejects.toThrow(ErrorValidacion);
    });
  });
});
