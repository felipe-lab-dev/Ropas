/**
 * Tests del SerieCpeController.
 *
 * Instanciamos el controller directamente (sin NestJS DI completo)
 * mockeando SerieCpeService directamente.
 */
import { SerieCpeController } from './series-cpe.controller';
import { SerieCpeService } from './series-cpe.service';
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

const SUCURSAL_ID = 'aaaa-bbbb-cccc-dddd-eeee11111111';
const SERIE_ID = 'ffff-gggg-hhhh-iiii-jjjj22222222';

function crearSerie(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SERIE_ID,
    sucursalId: SUCURSAL_ID,
    tipoCpe: 'factura',
    serie: 'F001',
    correlativoActual: 32,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    sucursal: { id: SUCURSAL_ID, nombre: 'Principal' },
    ...overrides,
  };
}

// ─── Factory de controller con mocks ─────────────────────────────────────────

let mockListar: jest.Mock;
let mockCrear: jest.Mock;
let controller: SerieCpeController;

function crearController() {
  mockListar = jest.fn();
  mockCrear = jest.fn();

  const mockService = {
    listar: mockListar,
    crear: mockCrear,
  } as unknown as SerieCpeService;

  return new SerieCpeController(mockService);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SerieCpeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    controller = crearController();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── 1. GET con filtro → shape OK ─────────────────────────────────────────

  it('GET con sucursalId filtra series y retorna { datos: [...] }', async () => {
    const series = [crearSerie(), crearSerie({ id: 'other', serie: 'F002' })];
    mockListar.mockResolvedValue(series);

    const resultado = await controller.listar(CTX_TEST, SUCURSAL_ID);

    expect(resultado).toEqual({ datos: series });
    expect(mockListar).toHaveBeenCalledWith(CTX_TEST, SUCURSAL_ID);
  });

  it('GET sin sucursalId llama service.listar(ctx, undefined) y retorna shape correcta', async () => {
    const series = [crearSerie()];
    mockListar.mockResolvedValue(series);

    const resultado = await controller.listar(CTX_TEST, undefined);

    expect(resultado.datos).toEqual(series);
    expect(mockListar).toHaveBeenCalledWith(CTX_TEST, undefined);
  });

  // ─── 2. POST → llama service.crear, retorna { datos } ────────────────────

  it('POST llama service.crear y retorna { datos: serieCpe }', async () => {
    const serieCreada = crearSerie();
    mockCrear.mockResolvedValue(serieCreada);

    const dto = {
      sucursalId: SUCURSAL_ID,
      tipoCpe: 'factura' as const,
      serie: 'F001',
    };
    const resultado = await controller.crear(CTX_TEST, dto);

    expect(resultado).toEqual({ datos: serieCreada });
    expect(mockCrear).toHaveBeenCalledWith(CTX_TEST, dto);
  });
});
