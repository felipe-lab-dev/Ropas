/**
 * Tests de VentaCreadaListener.
 *
 * Cobertura mínima:
 *   1. Happy path → llama emitirCpe con ctx derivado del tenantCode
 *   2. emitirCpe lanza error → catch lo captura, log warn, NO re-lanza
 *   3. onModuleInit suscribe al evento 'venta.creada'
 */
import { VentaCreadaListener } from './venta-creada.listener';
import { AppEventEmitter } from '../../../core/events/app-event-emitter';
import type { DocumentoElectronicoService } from '../documento-electronico/documento-electronico.service';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── helpers ────────────────────────────────────────────────────────────────

function crearDocElectronicoMock() {
  return {
    emitirCpe: jest.fn(),
  } as unknown as jest.Mocked<DocumentoElectronicoService>;
}

const PAYLOAD = { ventaId: 'venta-uuid-001', tenantCode: 'mi-tienda' };

/**
 * Ctx esperado que el listener construye internamente desde tenantCode='mi-tienda'.
 * Verificamos que el service recibe este ctx.
 */
const CTX_ESPERADO: TenantContext = {
  codigo: 'mi-tienda',
  schemaName: 'tenant_mi_tienda',
  nombre: 'mi-tienda',
  plan: '',
  modulosHabilitados: [],
  limites: {},
  accesoPermitido: true,
};

// ─── suite ──────────────────────────────────────────────────────────────────

describe('VentaCreadaListener', () => {
  let listener: VentaCreadaListener;
  let eventEmitter: AppEventEmitter;
  let documentoElectronicoService: jest.Mocked<DocumentoElectronicoService>;

  beforeEach(() => {
    eventEmitter = new AppEventEmitter();
    documentoElectronicoService = crearDocElectronicoMock();

    listener = new VentaCreadaListener(
      eventEmitter,
      documentoElectronicoService,
    );
  });

  // ─── Test 1: happy path — llama emitirCpe con ctx correcto ─────────────

  it('llama emitirCpe con ctx derivado del tenantCode', async () => {
    documentoElectronicoService.emitirCpe.mockResolvedValue({} as never);

    await listener.manejar(PAYLOAD);

    expect(documentoElectronicoService.emitirCpe).toHaveBeenCalledWith(CTX_ESPERADO, PAYLOAD.ventaId);
  });

  // ─── Test 2: emitirCpe lanza → catch, log warn, NO re-lanza ────────────

  it('captura el error de emitirCpe sin re-lanzar (log warn)', async () => {
    documentoElectronicoService.emitirCpe.mockRejectedValue(
      new Error('Mifact timeout'),
    );

    await expect(listener.manejar(PAYLOAD)).resolves.toBeUndefined();
  });

  // ─── Test 3: onModuleInit suscribe al evento 'venta.creada' ─────────────

  it('onModuleInit suscribe al eventEmitter y el handler se invoca al emitir', async () => {
    documentoElectronicoService.emitirCpe.mockResolvedValue({} as never);

    listener.onModuleInit();
    eventEmitter.emit('venta.creada', PAYLOAD);

    // Dejar que las promesas internas se resuelvan
    await new Promise(r => setTimeout(r, 10));

    expect(documentoElectronicoService.emitirCpe).toHaveBeenCalledWith(CTX_ESPERADO, PAYLOAD.ventaId);
  });
});
