/**
 * Tests de ConfiguracionFacturacionService.guardarConfiguracion()
 */
import { ConfiguracionFacturacionService } from './configuracion-facturacion.service';
import { ErrorAplicacion, ErrorNoEncontrado, ErrorValidacion } from '../../../core/errors/errores';
import { cifrar } from '../../../core/cifrado/cifrado';
import { GuardarConfiguracionFacturacionDto } from './dto/guardar-configuracion-facturacion.dto';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Mock types ──────────────────────────────────────────────────────────────

interface MockConfFact {
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
}

interface MockPrisma {
  configuracionFacturacion: MockConfFact;
}

function crearMockPrisma(): MockPrisma {
  return {
    configuracionFacturacion: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function crearMockPrismaTenancy(prismaMock: MockPrisma) {
  return {
    forTenant: jest.fn().mockReturnValue(prismaMock),
  };
}

const MASTER_KEY_TEST = 'test-key-32-bytes-aaaaaaaaaaaaaa';
const TOKEN_REAL = 'mifact-token-supersecret-abc123';

const CTX_TEST: TenantContext = {
  codigo: 'test',
  schemaName: 'tenant_test',
  nombre: 'Test',
  plan: '',
  modulosHabilitados: [],
  limites: {},
  accesoPermitido: true,
};

function dtoBase(overrides: Partial<GuardarConfiguracionFacturacionDto> = {}): GuardarConfiguracionFacturacionDto {
  return {
    ruc: '20123456789',
    razonSocial: 'Mi Tienda S.A.C.',
    direccionFiscal: 'Av. Principal 123, Cusco',
    ubigeoFiscalCodigo: '080101', // Cusco real
    mifactToken: TOKEN_REAL,
    ...overrides,
  } as GuardarConfiguracionFacturacionDto;
}

function filaExistente(overrides: object = {}) {
  return {
    id: 'cfg-uuid-001',
    mifactTokenCifrado: cifrar(TOKEN_REAL, MASTER_KEY_TEST),
    mifactBaseUrl: 'https://demo.mifact.net.pe',
    ruc: '20123456789',
    razonSocial: 'Mi Tienda S.A.C.',
    nombreComercial: null,
    direccionFiscal: 'Av. Principal 123, Cusco',
    ubigeoFiscalCodigo: '080101',
    enviarAutomaticoASunat: true,
    retornarPdf: true,
    retornarXmlEnvio: false,
    retornarXmlCdr: false,
    formatoImpresion: '001',
    correoNotificacion: null,
    emitirAlConfirmar: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ConfiguracionFacturacionService.guardarConfiguracion()', () => {
  let service: ConfiguracionFacturacionService;
  let prisma: MockPrisma;

  beforeEach(() => {
    process.env.FACTURACION_MASTER_KEY = MASTER_KEY_TEST;
    prisma = crearMockPrisma();
    service = new ConfiguracionFacturacionService(crearMockPrismaTenancy(prisma) as never);
    prisma.configuracionFacturacion.create.mockResolvedValue(filaExistente());
    prisma.configuracionFacturacion.update.mockResolvedValue(filaExistente());
  });

  afterEach(() => {
    delete process.env.FACTURACION_MASTER_KEY;
  });

  // ─── 1. Crear primera vez con todos los campos → create ──────────────────

  it('crear primera vez con token → usa create, retorna tokenConfigurado:true sin token plano', async () => {
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

    const resultado = await service.guardarConfiguracion(CTX_TEST, dtoBase());

    expect(prisma.configuracionFacturacion.create).toHaveBeenCalledTimes(1);
    expect(prisma.configuracionFacturacion.update).not.toHaveBeenCalled();
    expect(resultado.tokenConfigurado).toBe(true);
    expect(resultado.ruc).toBe('20123456789');
    // Asegurarse que el token plano NO está en el resultado
    expect((resultado as unknown as Record<string, unknown>)['mifactToken']).toBeUndefined();
    expect((resultado as unknown as Record<string, unknown>)['mifactTokenCifrado']).toBeUndefined();
  });

  // ─── 2. Actualizar sin pasar token → mantiene cifrado anterior ─────────

  it('actualizar existente sin token → mantiene mifactTokenCifrado anterior', async () => {
    const tokenCifradoPrevio = cifrar('token-anterior', MASTER_KEY_TEST);
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(
      filaExistente({ mifactTokenCifrado: tokenCifradoPrevio }),
    );

    await service.guardarConfiguracion(CTX_TEST, dtoBase({ mifactToken: undefined }));

    expect(prisma.configuracionFacturacion.update).toHaveBeenCalledTimes(1);
    const dataLlamada = prisma.configuracionFacturacion.update.mock.calls[0][0].data;
    expect(dataLlamada.mifactTokenCifrado).toBe(tokenCifradoPrevio);
  });

  // ─── 3. Actualizar con token nuevo → re-cifra ────────────────────────────

  it('actualizar con token nuevo → re-cifra el token', async () => {
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(filaExistente());

    await service.guardarConfiguracion(CTX_TEST, dtoBase({ mifactToken: 'nuevo-token-secreto' }));

    expect(prisma.configuracionFacturacion.update).toHaveBeenCalledTimes(1);
    const dataLlamada = prisma.configuracionFacturacion.update.mock.calls[0][0].data;
    // El nuevo token cifrado es distinto al original
    expect(dataLlamada.mifactTokenCifrado).not.toBe(filaExistente().mifactTokenCifrado);
    // Pero se puede descifrar correctamente
    const { descifrar } = await import('../../../core/cifrado/cifrado');
    expect(descifrar(dataLlamada.mifactTokenCifrado, MASTER_KEY_TEST)).toBe('nuevo-token-secreto');
  });

  // ─── 4. Crear sin token → ErrorValidacion ────────────────────────────────

  it('crear primera vez sin token → lanza ErrorValidacion', async () => {
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

    await expect(
      service.guardarConfiguracion(CTX_TEST, dtoBase({ mifactToken: undefined })),
    ).rejects.toThrow(ErrorValidacion);

    await expect(
      service.guardarConfiguracion(CTX_TEST, dtoBase({ mifactToken: '' })),
    ).rejects.toThrow(ErrorValidacion);
  });

  // ─── 5. UBIGEO inválido → ErrorValidacion ────────────────────────────────

  it('UBIGEO inválido → lanza ErrorValidacion', async () => {
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

    await expect(
      service.guardarConfiguracion(CTX_TEST, dtoBase({ ubigeoFiscalCodigo: '999999' })),
    ).rejects.toThrow(ErrorValidacion);

    await expect(
      service.guardarConfiguracion(CTX_TEST, dtoBase({ ubigeoFiscalCodigo: '999999' })),
    ).rejects.toThrow(/UBIGEO 999999 no es válido/i);
  });

  // ─── 6. Master key no configurada → ErrorAplicacion(500) ─────────────────

  it('FACTURACION_MASTER_KEY no definida → lanza ErrorAplicacion(500)', async () => {
    delete process.env.FACTURACION_MASTER_KEY;
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

    await expect(service.guardarConfiguracion(CTX_TEST, dtoBase())).rejects.toThrow(ErrorAplicacion);
    await expect(service.guardarConfiguracion(CTX_TEST, dtoBase())).rejects.toMatchObject({ codigo: 500 });
  });
});

// ─── Tests de obtenerConfiguracion (ya existentes, se reubican aquí para completar) ─

describe('ConfiguracionFacturacionService.obtenerConfiguracion() — edge cases ya cubiertos', () => {
  let service: ConfiguracionFacturacionService;
  let prisma: MockPrisma;

  beforeEach(() => {
    process.env.FACTURACION_MASTER_KEY = MASTER_KEY_TEST;
    prisma = crearMockPrisma();
    service = new ConfiguracionFacturacionService(crearMockPrismaTenancy(prisma) as never);
  });

  afterEach(() => {
    delete process.env.FACTURACION_MASTER_KEY;
  });

  it('sin config → lanza ErrorNoEncontrado', async () => {
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);
    await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(ErrorNoEncontrado);
  });
});
