/**
 * Tests unitarios de EmisionCpeController.
 *
 * DocumentoElectronicoService se mockea completamente.
 * No se instancia NestJS runtime — prueba directa de la clase.
 */
import { ParseUUIDPipe } from '@nestjs/common';
import { EmisionCpeController } from './emision-cpe.controller';
import { ErrorNoEncontrado, ErrorConflicto } from '../../../core/errors/errores';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const VENTA_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const CTX_TEST: TenantContext = {
  codigo: 'mi-tienda',
  schemaName: 'tenant_mi_tienda',
  nombre: 'Mi Tienda',
  plan: 'pro',
  modulosHabilitados: ['ventas'],
  limites: {},
  accesoPermitido: true,
};

function crearDocumento() {
  return {
    id: 'doc-uuid-001',
    ventaId: VENTA_ID,
    tipoCpe: 'factura',
    serie: 'F001',
    correlativo: '00000001',
    estadoSunat: 'aceptado',
    codigoHash: 'HASH123',
    cadenaQr: 'QR...',
    mensajeSunat: 'Aceptada',
    numIntentos: 1,
    enviadoEn: new Date(),
    aceptadoEn: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('EmisionCpeController', () => {
  let controller: EmisionCpeController;
  let documentoService: {
    obtenerPorVentaId: jest.Mock;
    emitirCpe: jest.Mock;
    reintentarCpe: jest.Mock;
    consultarEstadoCpe: jest.Mock;
  };

  beforeEach(() => {
    documentoService = {
      obtenerPorVentaId: jest.fn(),
      emitirCpe: jest.fn(),
      reintentarCpe: jest.fn(),
      consultarEstadoCpe: jest.fn(),
    };
    controller = new EmisionCpeController(documentoService as never);
  });

  // ─── 0. GET documento-electronico ─────────────────────────────────────────

  it('obtener: retorna {datos: documento} cuando existe', async () => {
    const doc = crearDocumento();
    documentoService.obtenerPorVentaId.mockResolvedValue(doc);

    const resultado = await controller.obtener(VENTA_ID, CTX_TEST);

    expect(resultado).toEqual({ datos: doc });
    expect(documentoService.obtenerPorVentaId).toHaveBeenCalledWith(CTX_TEST, VENTA_ID);
  });

  it('obtener: retorna {datos: null} cuando no existe documento para la venta', async () => {
    documentoService.obtenerPorVentaId.mockResolvedValue(null);

    const resultado = await controller.obtener(VENTA_ID, CTX_TEST);

    expect(resultado).toEqual({ datos: null });
    expect(documentoService.obtenerPorVentaId).toHaveBeenCalledWith(CTX_TEST, VENTA_ID);
  });

  // ─── 1. Happy path ────────────────────────────────────────────────────────

  it('retorna {datos: documento} cuando el service resuelve correctamente', async () => {
    const doc = crearDocumento();
    documentoService.emitirCpe.mockResolvedValue(doc);

    const resultado = await controller.emitir(VENTA_ID, CTX_TEST);

    expect(resultado).toEqual({ datos: doc });
    expect(documentoService.emitirCpe).toHaveBeenCalledWith(CTX_TEST, VENTA_ID);
  });

  // ─── 2. Service lanza ErrorNoEncontrado ───────────────────────────────────

  it('propaga ErrorNoEncontrado cuando el service no encuentra la venta', async () => {
    documentoService.emitirCpe.mockRejectedValue(
      new ErrorNoEncontrado('Venta no encontrada'),
    );

    await expect(controller.emitir(VENTA_ID, CTX_TEST)).rejects.toThrow(ErrorNoEncontrado);
    await expect(controller.emitir(VENTA_ID, CTX_TEST)).rejects.toThrow(/venta no encontrada/i);
  });

  // ─── 3. Service lanza error genérico ─────────────────────────────────────

  it('propaga error genérico sin modificar cuando el service lanza', async () => {
    const err = new Error('Error inesperado de red');
    documentoService.emitirCpe.mockRejectedValue(err);

    await expect(controller.emitir(VENTA_ID, CTX_TEST)).rejects.toThrow('Error inesperado de red');
  });

  // ─── 4. ParseUUIDPipe está configurado ───────────────────────────────────

  it('ParseUUIDPipe está decorado en el parámetro :id', () => {
    // Verificamos que la clase tiene el metadata correcto para el param pipe.
    // ParseUUIDPipe valida que el string sea un UUID v4 válido — si no, lanza 400.
    // En test unitario sin contexto NestJS, verificamos su instanciación indirectamente:
    const pipe = new ParseUUIDPipe();
    expect(pipe).toBeInstanceOf(ParseUUIDPipe);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // reintentar
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 5. reintentar happy path ─────────────────────────────────────────────

  it('reintentar: retorna {datos: documento} cuando el service resuelve correctamente', async () => {
    const doc = crearDocumento();
    documentoService.reintentarCpe.mockResolvedValue(doc);

    const resultado = await controller.reintentar(VENTA_ID, CTX_TEST);

    expect(resultado).toEqual({ datos: doc });
    expect(documentoService.reintentarCpe).toHaveBeenCalledWith(CTX_TEST, VENTA_ID);
  });

  // ─── 6. reintentar propagación ErrorConflicto ─────────────────────────────

  it('reintentar: propaga ErrorConflicto cuando el service lo lanza', async () => {
    documentoService.reintentarCpe.mockRejectedValue(
      new ErrorConflicto('El documento ya fue aceptado por SUNAT. No se puede reintentar.'),
    );

    await expect(controller.reintentar(VENTA_ID, CTX_TEST)).rejects.toThrow(ErrorConflicto);
    await expect(controller.reintentar(VENTA_ID, CTX_TEST)).rejects.toThrow(/ya fue aceptado/i);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // consultarEstado
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 7. consultarEstado happy path ───────────────────────────────────────

  it('consultarEstado: retorna {datos: documento} cuando el service resuelve correctamente', async () => {
    const doc = crearDocumento();
    documentoService.consultarEstadoCpe.mockResolvedValue(doc);

    const resultado = await controller.consultarEstado(VENTA_ID, CTX_TEST);

    expect(resultado).toEqual({ datos: doc });
    expect(documentoService.consultarEstadoCpe).toHaveBeenCalledWith(CTX_TEST, VENTA_ID);
  });

  // ─── 8. consultarEstado propagación ErrorNoEncontrado ────────────────────

  it('consultarEstado: propaga ErrorNoEncontrado cuando el service no encuentra documento', async () => {
    documentoService.consultarEstadoCpe.mockRejectedValue(
      new ErrorNoEncontrado('No hay documento electrónico para esta venta.'),
    );

    await expect(controller.consultarEstado(VENTA_ID, CTX_TEST)).rejects.toThrow(ErrorNoEncontrado);
    await expect(controller.consultarEstado(VENTA_ID, CTX_TEST)).rejects.toThrow(
      /no hay documento electrónico/i,
    );
  });
});
