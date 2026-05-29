/**
 * Tests del ConfiguracionFacturacionController.
 *
 * Instanciamos el controller directamente (sin NestJS DI completo)
 * mockeando ConfiguracionFacturacionService directamente.
 */
import { ConfiguracionFacturacionController } from './configuracion-facturacion.controller';
import { ConfiguracionFacturacionService } from './configuracion-facturacion.service';
import { ErrorNoEncontrado } from '../../../core/errors/errores';
import { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Tenant de prueba ─────────────────────────────────────────────────────────

const CTX_TEST: TenantContext = {
  codigo: 'mi-tienda',
  schemaName: 'tenant_mi_tienda',
  nombre: 'Mi Tienda',
  plan: 'pro',
  modulosHabilitados: ['facturacion-electronica'],
  limites: {},
  accesoPermitido: true,
};

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const CONFIG_RESUELTA = {
  mifactToken: 'token-secreto-que-no-debe-salir',
  mifactBaseUrl: 'https://demo.mifact.net.pe/api',
  ruc: '20123456789',
  razonSocial: 'Mi Tienda S.A.C.',
  nombreComercial: 'Mi Tienda',
  direccionFiscal: 'Av. Principal 123, Cusco',
  ubigeoFiscalCodigo: '080101',
  formatoImpresion: '001',
};

// ─── Mocks ───────────────────────────────────────────────────────────────────

let mockObtener: jest.Mock;
let mockGuardar: jest.Mock;
let controller: ConfiguracionFacturacionController;

function crearController() {
  mockObtener = jest.fn();
  mockGuardar = jest.fn();

  // Sobreescribir el prototype para que la instancia use nuestros mocks
  jest.spyOn(ConfiguracionFacturacionService.prototype, 'obtenerConfiguracion')
    .mockImplementation(mockObtener);
  jest.spyOn(ConfiguracionFacturacionService.prototype, 'guardarConfiguracion')
    .mockImplementation(mockGuardar);

  // ConfiguracionFacturacionController ahora recibe ConfiguracionFacturacionService directamente
  // Instanciamos con un mock del service
  const mockService = {
    obtenerConfiguracion: mockObtener,
    guardarConfiguracion: mockGuardar,
  } as unknown as ConfiguracionFacturacionService;

  return new ConfiguracionFacturacionController(mockService);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ConfiguracionFacturacionController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    controller = crearController();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── 1. GET con config → response shape OK, sin token plano ──────────────

  it('GET con config existente retorna shape correcto y NO expone el token', async () => {
    mockObtener.mockResolvedValue(CONFIG_RESUELTA);

    const resultado = await controller.obtener(CTX_TEST);

    expect(resultado.datos).toBeDefined();
    const datos = resultado.datos!;
    // Token como booleano
    expect(datos.tokenConfigurado).toBe(true);
    // El token plano NUNCA debe estar en la respuesta
    expect((datos as unknown as Record<string, unknown>)['mifactToken']).toBeUndefined();
    // Campos presentes
    expect(datos.ruc).toBe('20123456789');
    expect(datos.razonSocial).toBe('Mi Tienda S.A.C.');
    expect(datos.ubigeoFiscalCodigo).toBe('080101');
  });

  // ─── 2. GET sin config → { datos: null } ─────────────────────────────────

  it('GET sin config retorna { datos: null } en lugar de lanzar 404', async () => {
    mockObtener.mockRejectedValue(new ErrorNoEncontrado('no hay config'));

    const resultado = await controller.obtener(CTX_TEST);

    expect(resultado).toEqual({ datos: null });
  });

  // ─── 3. PUT → llama service.guardar y retorna resultado ──────────────────

  it('PUT llama a guardarConfiguracion y retorna resultado con mensaje', async () => {
    const resultadoGuardado = {
      tokenConfigurado: true,
      ruc: '20123456789',
      razonSocial: 'Mi Tienda S.A.C.',
      nombreComercial: null,
      direccionFiscal: 'Av. Principal 123, Cusco',
      ubigeoFiscalCodigo: '080101',
      mifactBaseUrl: 'https://demo.mifact.net.pe/api',
      formatoImpresion: '001',
    };
    mockGuardar.mockResolvedValue(resultadoGuardado);

    const dto = {
      ruc: '20123456789',
      razonSocial: 'Mi Tienda S.A.C.',
      direccionFiscal: 'Av. Principal 123, Cusco',
      ubigeoFiscalCodigo: '080101',
      mifactToken: 'nuevo-token',
    } as Parameters<typeof controller.guardar>[0];

    const resultado = await controller.guardar(dto, CTX_TEST);

    expect(mockGuardar).toHaveBeenCalledWith(CTX_TEST, dto);
    expect(resultado.datos).toEqual(resultadoGuardado);
    expect(resultado.mensaje).toContain('guardada');
  });
});
