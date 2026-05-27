/**
 * Tests de ConfiguracionFacturacionService.
 *
 * Mockeamos prismaTenancy.forTenant() que retorna un mock de PrismaClient.
 * Usamos cifrar() real para preparar el token cifrado de prueba.
 */
import { ConfiguracionFacturacionService } from './configuracion-facturacion.service';
import { ErrorNoEncontrado, ErrorAplicacion, ErrorValidacion } from '../../../core/errors/errores';
import { cifrar } from '../../../core/cifrado/cifrado';
import { GuardarConfiguracionFacturacionDto } from './dto/guardar-configuracion-facturacion.dto';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Mock types ──────────────────────────────────────────────────────────────

interface MockConfiguracionFacturacion {
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
}

interface MockPrisma {
  configuracionFacturacion: MockConfiguracionFacturacion;
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

  // ─── obtenerConfiguracion ─────────────────────────────────────────────────

  describe('obtenerConfiguracion', () => {
    // ─── 1. Happy path ──────────────────────────────────────────────────────

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

    // ─── 2. Sin config ──────────────────────────────────────────────────────

    it('lanza ErrorNoEncontrado con mensaje específico cuando no hay config', async () => {
      prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

      await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(ErrorNoEncontrado);

      await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(
        /configuración de facturación electrónica/i,
      );
    });

    // ─── 3. Sin FACTURACION_MASTER_KEY ─────────────────────────────────────

    it('lanza ErrorAplicacion(500) cuando FACTURACION_MASTER_KEY no está definida', async () => {
      delete process.env.FACTURACION_MASTER_KEY;
      prisma.configuracionFacturacion.findFirst.mockResolvedValue(filaConfig());

      await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(ErrorAplicacion);

      await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toMatchObject({
        codigo: 500,
      });
    });

    // ─── 4. Token mal cifrado — el error se propaga ─────────────────────────

    it('propaga el error de descifrado si mifactTokenCifrado está corrompido', async () => {
      prisma.configuracionFacturacion.findFirst.mockResolvedValue(
        filaConfig({ mifactTokenCifrado: 'blob-invalido-que-no-es-gcm-valido-aaaaaaaaaaa' }),
      );

      await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(
        /autenticación GCM fallida|demasiado corto/i,
      );
    });

    // ─── 5. Edge case — sin config (variante) ──────────────────────────────

    it('sin config → lanza ErrorNoEncontrado', async () => {
      prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);
      await expect(service.obtenerConfiguracion(CTX_TEST)).rejects.toThrow(ErrorNoEncontrado);
    });
  });

  // ─── guardarConfiguracion ─────────────────────────────────────────────────

  describe('guardarConfiguracion', () => {
    beforeEach(() => {
      prisma.configuracionFacturacion.create.mockResolvedValue(filaExistente());
      prisma.configuracionFacturacion.update.mockResolvedValue(filaExistente());
    });

    // ─── 1. Crear primera vez con todos los campos → create ────────────────

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

    // ─── 3. Actualizar con token nuevo → re-cifra ──────────────────────────

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

    // ─── 4. Crear sin token → ErrorValidacion ──────────────────────────────

    it('crear primera vez sin token → lanza ErrorValidacion', async () => {
      prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

      await expect(
        service.guardarConfiguracion(CTX_TEST, dtoBase({ mifactToken: undefined })),
      ).rejects.toThrow(ErrorValidacion);

      await expect(
        service.guardarConfiguracion(CTX_TEST, dtoBase({ mifactToken: '' })),
      ).rejects.toThrow(ErrorValidacion);
    });

    // ─── 5. UBIGEO inválido → ErrorValidacion ──────────────────────────────

    it('UBIGEO inválido → lanza ErrorValidacion', async () => {
      prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

      await expect(
        service.guardarConfiguracion(CTX_TEST, dtoBase({ ubigeoFiscalCodigo: '999999' })),
      ).rejects.toThrow(ErrorValidacion);

      await expect(
        service.guardarConfiguracion(CTX_TEST, dtoBase({ ubigeoFiscalCodigo: '999999' })),
      ).rejects.toThrow(/UBIGEO 999999 no es válido/i);
    });

    // ─── 6. Master key no configurada → ErrorAplicacion(500) ───────────────

    it('FACTURACION_MASTER_KEY no definida → lanza ErrorAplicacion(500)', async () => {
      delete process.env.FACTURACION_MASTER_KEY;
      prisma.configuracionFacturacion.findFirst.mockResolvedValue(null);

      await expect(service.guardarConfiguracion(CTX_TEST, dtoBase())).rejects.toThrow(ErrorAplicacion);
      await expect(service.guardarConfiguracion(CTX_TEST, dtoBase())).rejects.toMatchObject({ codigo: 500 });
    });
  });
});
