/**
 * Tests de VentaCreadaListener.
 *
 * Cobertura mínima:
 *   1. Config emitirAlConfirmar=true → llama emitirCpe exitosamente
 *   2. Config emitirAlConfirmar=false → NO llama emitirCpe, log "skipeando"
 *   3. emitirCpe lanza error → catch lo captura, log warn, NO re-lanza
 *   4. obtenerConfiguracion lanza error → catch lo captura, NO re-lanza
 */
import { VentaCreadaListener } from './venta-creada.listener';
import { AppEventEmitter } from '../../../core/events/app-event-emitter';
import type { ConfiguracionFacturacionService } from '../configuracion/configuracion-facturacion.service';
import type { DocumentoElectronicoService } from '../documento-electronico/documento-electronico.service';
import type { ConfiguracionFacturacionResuelta } from '../configuracion/configuracion-facturacion.service';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── helpers ────────────────────────────────────────────────────────────────

function crearConfigMock() {
  return {
    obtenerConfiguracion: jest.fn(),
  } as unknown as jest.Mocked<ConfiguracionFacturacionService>;
}

function crearDocElectronicoMock() {
  return {
    emitirCpe: jest.fn(),
  } as unknown as jest.Mocked<DocumentoElectronicoService>;
}

function configResuelta(emitirAlConfirmar: boolean): ConfiguracionFacturacionResuelta {
  return {
    mifactToken: 'tok',
    mifactBaseUrl: 'https://demo.mifact.net.pe',
    ruc: '20123456789',
    razonSocial: 'Mi Tienda S.A.C.',
    nombreComercial: null,
    direccionFiscal: 'Av. 1',
    ubigeoFiscalCodigo: '080101',
    enviarAutomaticoASunat: true,
    retornarPdf: true,
    retornarXmlEnvio: false,
    retornarXmlCdr: false,
    formatoImpresion: '001',
    correoNotificacion: null,
    emitirAlConfirmar,
  };
}

const PAYLOAD = { ventaId: 'venta-uuid-001', tenantCode: 'mi-tienda' };

/**
 * Ctx esperado que el listener construye internamente desde tenantCode='mi-tienda'.
 * Verificamos que los services reciben este ctx.
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
  let configuracionService: jest.Mocked<ConfiguracionFacturacionService>;
  let documentoElectronicoService: jest.Mocked<DocumentoElectronicoService>;

  beforeEach(() => {
    eventEmitter = new AppEventEmitter();
    configuracionService = crearConfigMock();
    documentoElectronicoService = crearDocElectronicoMock();

    listener = new VentaCreadaListener(
      eventEmitter,
      configuracionService,
      documentoElectronicoService,
    );
  });

  // ─── Test 1: config emitirAlConfirmar=true → llama emitirCpe ───────────

  it('llama emitirCpe cuando emitirAlConfirmar=true', async () => {
    configuracionService.obtenerConfiguracion.mockResolvedValue(configResuelta(true));
    documentoElectronicoService.emitirCpe.mockResolvedValue({} as never);

    await listener.manejar(PAYLOAD);

    expect(configuracionService.obtenerConfiguracion).toHaveBeenCalledTimes(1);
    expect(configuracionService.obtenerConfiguracion).toHaveBeenCalledWith(CTX_ESPERADO);
    expect(documentoElectronicoService.emitirCpe).toHaveBeenCalledWith(CTX_ESPERADO, PAYLOAD.ventaId);
  });

  // ─── Test 2: config emitirAlConfirmar=false → NO llama emitirCpe ───────

  it('NO llama emitirCpe cuando emitirAlConfirmar=false', async () => {
    configuracionService.obtenerConfiguracion.mockResolvedValue(configResuelta(false));

    await listener.manejar(PAYLOAD);

    expect(documentoElectronicoService.emitirCpe).not.toHaveBeenCalled();
  });

  // ─── Test 3: emitirCpe lanza → catch, log warn, NO re-lanza ────────────

  it('captura el error de emitirCpe sin re-lanzar (log warn)', async () => {
    configuracionService.obtenerConfiguracion.mockResolvedValue(configResuelta(true));
    documentoElectronicoService.emitirCpe.mockRejectedValue(
      new Error('Mifact timeout'),
    );

    // No debe rechazar
    await expect(listener.manejar(PAYLOAD)).resolves.toBeUndefined();
  });

  // ─── Test 4: obtenerConfiguracion lanza → catch, NO re-lanza ───────────

  it('captura el error de obtenerConfiguracion sin re-lanzar', async () => {
    configuracionService.obtenerConfiguracion.mockRejectedValue(
      new Error('Tenant sin config de facturación'),
    );

    await expect(listener.manejar(PAYLOAD)).resolves.toBeUndefined();
    expect(documentoElectronicoService.emitirCpe).not.toHaveBeenCalled();
  });

  // ─── Test 5: onModuleInit suscribe al evento 'venta.creada' ─────────────

  it('onModuleInit suscribe al eventEmitter y el handler se invoca al emitir', async () => {
    configuracionService.obtenerConfiguracion.mockResolvedValue(configResuelta(true));
    documentoElectronicoService.emitirCpe.mockResolvedValue({} as never);

    listener.onModuleInit();
    eventEmitter.emit('venta.creada', PAYLOAD);

    // Dejar que las promesas internas se resuelvan
    await new Promise(r => setTimeout(r, 10));

    expect(documentoElectronicoService.emitirCpe).toHaveBeenCalledWith(CTX_ESPERADO, PAYLOAD.ventaId);
  });
});
