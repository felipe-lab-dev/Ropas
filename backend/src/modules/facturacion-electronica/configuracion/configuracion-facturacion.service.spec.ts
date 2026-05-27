/**
 * Tests de ConfiguracionFacturacionService.
 *
 * Mockeamos prismaTenancy.forTenant() que retorna un mock de PrismaClient.
 * Usamos cifrar() real para preparar el token cifrado de prueba.
 */
import { ConfiguracionFacturacionService } from './configuracion-facturacion.service';
import { ErrorNoEncontrado, ErrorAplicacion } from '../../../core/errors/errores';
import { cifrar } from '../../../core/cifrado/cifrado';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Mock types ──────────────────────────────────────────────────────────────

interface MockConfiguracionFacturacion {
  findFirst: jest.Mock;
}

interface MockPrisma {
  configuracionFacturacion: MockConfiguracionFacturacion;
}

function crearMockPrisma(): MockPrisma {
  return {
    configuracionFacturacion: {
      findFirst: jest.fn(),
    },
  };
}

function crearMockPrismaTenancy(prismaMock: MockPrisma) {
  return {
    forTenant: jest.fn().mockReturnValue(prismaMock),
  };
}

// ─── Clave maestra de prueba ──────────────────────────────────────────────────

const MASTER_KEY_TEST = 'test-key-32-bytes-aaaaaaaaaaaaaa';
const TOKEN_REAL = 'mifact-token-supersecret-abc123';

// ─── Contexto de prueba ───────────────────────────────────────────────────────

const CTX_TEST: TenantContext = {
  codigo: 'test',
  schemaName: 'tenant_test',
  nombre: 'Test',
  plan: '',
  modulosHabilitados: [],
  limites: {},
  accesoPermitido: true,
};

// ─── Fila de BD de prueba ────────────────────────────────────────────────────

function filaConfig(overrides: Partial<{
  mifactTokenCifrado: string;
  mifactBaseUrl: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccionFiscal: string;
  ubigeoFiscalCodigo: string;
  enviarAutomaticoASunat: boolean;
  retornarPdf: boolean;
  retornarXmlEnvio: boolean;
  retornarXmlCdr: boolean;
  formatoImpresion: string;
  correoNotificacion: string | null;
  emitirAlConfirmar: boolean;
}> = {}) {
  return {
    id: 'cfg-uuid-001',
    mifactTokenCifrado: cifrar(TOKEN_REAL, MASTER_KEY_TEST),
    mifactBaseUrl: 'https://demo.mifact.net.pe',
    ruc: '20123456789',
    razonSocial: 'Mi Tienda S.A.C.',
    nombreComercial: 'Mi Tienda',
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

describe('ConfiguracionFacturacionService', () => {
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

  // ─── 1. Happy path ────────────────────────────────────────────────────────

  it('retorna DTO con token descifrado correctamente', async () => {
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(filaConfig());

    const resultado = await service.obtenerConfiguracion(CTX_TEST);

    expect(resultado.mifactToken).toBe(TOKEN_REAL);
    expect(resultado.ruc).toBe('20123456789');
    expect(resultado.razonSocial).toBe('Mi Tienda S.A.C.');
    expect(resultado.mifactBaseUrl).toBe('https://demo.mifact.net.pe');
    expect(resultado.enviarAutomaticoASunat).toBe(true);
    expect(resultado.retornarPdf).toBe(true);
    expect(resultado.retornarXmlEnvio).toBe(false);
    expect(resultado.retornarXmlCdr).toBe(false);
    expect(resultado.formatoImpresion).toBe('001');
    expect(resultado.correoNotificacion).toBeNull();
  });

  // ─── 2. Sin config ────────────────────────────────────────────────────────

  it('lanza ErrorNoEncontrado con mensaje específico cuando no hay config', async () => {
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

    await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(ErrorNoEncontrado);

    await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(
      /configuración de facturación electrónica/i,
    );
  });

  // ─── 3. Sin FACTURACION_MASTER_KEY ───────────────────────────────────────

  it('lanza ErrorAplicacion(500) cuando FACTURACION_MASTER_KEY no está definida', async () => {
    delete process.env.FACTURACION_MASTER_KEY;
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(filaConfig());

    await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(ErrorAplicacion);

    await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toMatchObject({
      codigo: 500,
    });
  });

  // ─── 4. Token mal cifrado — el error se propaga ───────────────────────────

  it('propaga el error de descifrado si mifactTokenCifrado está corrompido', async () => {
    prisma.configuracionFacturacion.findFirst.mockResolvedValue(
      filaConfig({ mifactTokenCifrado: 'blob-invalido-que-no-es-gcm-valido-aaaaaaaaaaa' }),
    );

    await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(
      /autenticación GCM fallida|demasiado corto/i,
    );
  });
});
