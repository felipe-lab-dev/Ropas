/**
 * Tests unitarios de DocumentoElectronicoService.
 *
 * Todos los deps (PrismaTenantService, ConfiguracionFacturacionService, SerieCpeService,
 * CpeOrquestadorService, MifactService) se mockean con jest.fn().
 * No hay DB, no hay HTTP, no hay NestJS runtime.
 */
import { DocumentoElectronicoService } from './documento-electronico.service';
import { ErrorNoEncontrado, ErrorConflicto, ErrorValidacion } from '../../../core/errors/errores';
import type { MifactRespuesta } from '../mifact/types';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

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

// ─── Factories de mocks ───────────────────────────────────────────────────────

function crearMockPrisma() {
  return {
    documentoElectronico: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    venta: {
      findUnique: jest.fn(),
    },
  };
}

function crearMockPrismaTenancy(prismaMock: ReturnType<typeof crearMockPrisma>) {
  return {
    forTenant: jest.fn().mockReturnValue(prismaMock),
  };
}

function crearMockConfiguracion() {
  return {
    obtenerConfiguracion: jest.fn().mockResolvedValue({
      mifactToken: 'token-descifrado',
      mifactBaseUrl: 'https://demo.mifact.net.pe/api',
      ruc: '20100100100',
      razonSocial: 'EMPRESA TEST SAC',
      nombreComercial: 'Test Store',
      direccionFiscal: 'Av. Test 123',
      ubigeoFiscalCodigo: '150101',
      formatoImpresion: '001',
    }),
  };
}

function crearMockSerieCpe() {
  return {
    asignarProximoCorrelativo: jest.fn().mockResolvedValue({
      serieCpeId: 'serie-uuid-001',
      serie: 'F001',
      correlativo: '00000001',
    }),
  };
}

function crearMockOrquestador() {
  return {
    construirCpe: jest.fn().mockReturnValue({ token: 'tok', operacion: {} }),
  };
}

function crearMockMifact() {
  return {
    enviarCpe: jest.fn(),
    consultarEstado: jest.fn(),
    anularCpe: jest.fn(),
  };
}

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const VENTA_ID = 'venta-uuid-001';
const SUCURSAL_ID = 'sucursal-uuid-001';

function crearItem(overrides = {}) {
  return {
    id: 'item-uuid-001',
    variante: {
      sku: 'TSHIRT-M-ROJO',
      producto: {
        unidadMedidaCodigo: 'NIU',
        tipoAfectacionIgv: 'gravado_onerosa',
      },
    },
    descripcion: 'Camiseta M Rojo',
    cantidad: 2,
    precioUnitario: { toString: () => '59.00' },
    descuento: { toString: () => '0.00' },
    subtotal: { toString: () => '100.00' },
    ...overrides,
  };
}

function crearSucursal(overrides = {}) {
  return {
    id: SUCURSAL_ID,
    codigo: 'SUC-01',
    nombre: 'Sucursal Principal',
    ...overrides,
  };
}

function crearClienteRuc() {
  return {
    id: 'cliente-uuid-001',
    tipoDocumento: 'ruc' as const,
    documento: '20100200300',
    nombre: 'CLIENTE EMPRESA SAC',
    email: 'empresa@test.com',
    direccion: 'Av. Empresa 456',
  };
}

function crearClienteDni() {
  return {
    id: 'cliente-uuid-002',
    tipoDocumento: 'dni' as const,
    documento: '12345678',
    nombre: 'Juan Pérez',
    email: 'juan@test.com',
    direccion: null,
  };
}

function crearVenta(clienteOverride: unknown = crearClienteRuc()) {
  return {
    id: VENTA_ID,
    sucursalId: SUCURSAL_ID,
    sucursal: crearSucursal(),
    cliente: clienteOverride,
    clienteId: clienteOverride ? (clienteOverride as { id: string }).id : null,
    moneda: 'PEN',
    tipoCambio: { toString: () => '1.000' },
    codigoTipoOperacionSunat: '0101',
    creadoEn: new Date('2025-05-27T00:00:00Z'),
    items: [crearItem()],
  };
}

function crearRespuestaMifact(overrides: Partial<MifactRespuesta> = {}): MifactRespuesta {
  return {
    errors: '',
    estadoSunat: 'aceptado',
    estadoDocumentoCodigo: '102',
    tipoCpe: '01',
    serieCpe: 'F001',
    correlativoCpe: '00000001',
    url: 'https://demo.mifact.net.pe/doc/F001-1.pdf',
    sunatDescription: 'La Factura numero F001-00000001, ha sido aceptada',
    sunatNote: '',
    sunatResponsecode: '0',
    pdfBytes: 'base64pdf==',
    xmlEnviado: '<Invoice/>',
    cdrSunat: '<ApplicationResponse/>',
    cadenaParaCodigoQr: '20100100100|01|F001|00000001|...',
    codigoHash: 'ABCDEF1234',
    ticketSunat: '',
    ...overrides,
  };
}

function crearDocumentoExistente(estadoSunat: string) {
  return {
    id: 'doc-uuid-001',
    ventaId: VENTA_ID,
    tipoCpe: 'factura',
    serie: 'F001',
    correlativo: '00000001',
    estadoSunat,
    codigoHash: 'HASH123',
    cadenaQr: 'QR...',
    mensajeSunat: 'Aceptada',
    numIntentos: 1,
    enviadoEn: new Date(),
    aceptadoEn: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    notaCreditoId: null,
    xmlEnviadoUrl: null,
    cdrUrl: null,
    pdfUrl: null,
    ultimoErrorTexto: null,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('DocumentoElectronicoService', () => {
  let service: DocumentoElectronicoService;
  let prisma: ReturnType<typeof crearMockPrisma>;
  let configuracionService: ReturnType<typeof crearMockConfiguracion>;
  let serieCpeService: ReturnType<typeof crearMockSerieCpe>;
  let orquestador: ReturnType<typeof crearMockOrquestador>;
  let mifactService: ReturnType<typeof crearMockMifact>;

  beforeEach(() => {
    prisma = crearMockPrisma();
    configuracionService = crearMockConfiguracion();
    serieCpeService = crearMockSerieCpe();
    orquestador = crearMockOrquestador();
    mifactService = crearMockMifact();

    service = new DocumentoElectronicoService(
      crearMockPrismaTenancy(prisma) as never,
      configuracionService as never,
      serieCpeService as never,
      orquestador as never,
      mifactService as never,
    );
  });

  // ─── 1. Happy path — factura (cliente RUC) ────────────────────────────────

  it('happy path factura: venta con cliente RUC → tipoCpe factura, persiste con estadoSunat aceptado', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteRuc()));
    mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
    const docPersistido = crearDocumentoExistente('aceptado');
    prisma.documentoElectronico.upsert.mockResolvedValue(docPersistido);

    const resultado = await service.emitirCpe(CTX_TEST, VENTA_ID);

    expect(resultado.estadoSunat).toBe('aceptado');
    expect(serieCpeService.asignarProximoCorrelativo).toHaveBeenCalledWith(
      CTX_TEST,
      SUCURSAL_ID,
      'factura',
    );
    expect(prisma.documentoElectronico.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tipoCpe: 'factura',
          estadoSunat: 'aceptado',
          aceptadoEn: expect.any(Date),
        }),
      }),
    );
  });

  // ─── 2. Happy path — boleta (cliente DNI) ────────────────────────────────

  it('happy path boleta: venta con cliente DNI → tipoCpe boleta', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteDni()));
    mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
    prisma.documentoElectronico.upsert.mockResolvedValue(crearDocumentoExistente('aceptado'));

    await service.emitirCpe(CTX_TEST, VENTA_ID);

    expect(serieCpeService.asignarProximoCorrelativo).toHaveBeenCalledWith(
      CTX_TEST,
      SUCURSAL_ID,
      'boleta',
    );
    expect(orquestador.construirCpe).toHaveBeenCalledWith(
      expect.objectContaining({
        venta: expect.objectContaining({ tipoCpe: 'boleta' }),
      }),
    );
  });

  // ─── 3. Boleta VARIOS — sin cliente ──────────────────────────────────────

  it('boleta consumidor final: venta sin cliente → receptor={otro(0),00000000,CLIENTE SIN NOMBRE,SIN DIRECCION}', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue(crearVenta(null));
    mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
    prisma.documentoElectronico.upsert.mockResolvedValue(crearDocumentoExistente('aceptado'));

    await service.emitirCpe(CTX_TEST, VENTA_ID);

    expect(serieCpeService.asignarProximoCorrelativo).toHaveBeenCalledWith(
      CTX_TEST,
      SUCURSAL_ID,
      'boleta',
    );
    // Convención documentada por Mifact para boleta sin DNI: tipo '0' (que en el
    // catálogo local es 'otro') + '00000000' + placeholders de nombre/dirección.
    expect(orquestador.construirCpe).toHaveBeenCalledWith(
      expect.objectContaining({
        receptor: {
          tipoDocumento: 'otro',
          numeroDocumento: '00000000',
          razonSocial: 'CLIENTE SIN NOMBRE',
          direccion: 'SIN DIRECCION',
        },
      }),
    );
  });

  // ─── 3b. Boleta > S/700 sin DNI → bloqueada (guard SUNAT) ─────────────────

  it('boleta > S/700 sin cliente: lanza ErrorValidacion y NO consume correlativo ni llama a Mifact', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue({ ...crearVenta(null), total: 800 });

    await expect(service.emitirCpe(CTX_TEST, VENTA_ID)).rejects.toBeInstanceOf(ErrorValidacion);

    expect(serieCpeService.asignarProximoCorrelativo).not.toHaveBeenCalled();
    expect(mifactService.enviarCpe).not.toHaveBeenCalled();
  });

  it('boleta > S/700 con cliente DNI identificado: emite normalmente', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue({ ...crearVenta(crearClienteDni()), total: 800 });
    mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
    prisma.documentoElectronico.upsert.mockResolvedValue(crearDocumentoExistente('aceptado'));

    await service.emitirCpe(CTX_TEST, VENTA_ID);

    expect(serieCpeService.asignarProximoCorrelativo).toHaveBeenCalledWith(
      CTX_TEST,
      SUCURSAL_ID,
      'boleta',
    );
    expect(mifactService.enviarCpe).toHaveBeenCalled();
  });

  // ─── 3c. Factura sin RUC válido → bloqueada (bug fallback 00000000) ───────

  it('factura con cliente RUC pero sin documento: lanza ErrorValidacion (no manda RUC 00000000)', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue(
      crearVenta({
        id: 'cliente-uuid-099',
        tipoDocumento: 'ruc',
        documento: null,
        nombre: 'EMPRESA SIN RUC SAC',
        email: null,
        direccion: null,
      }),
    );

    await expect(service.emitirCpe(CTX_TEST, VENTA_ID)).rejects.toBeInstanceOf(ErrorValidacion);
    expect(mifactService.enviarCpe).not.toHaveBeenCalled();
  });

  // ─── 4. Idempotencia — estado aceptado ───────────────────────────────────

  it('idempotencia: si ya existe documento con estado=aceptado, retorna existente sin llamar a Mifact', async () => {
    const docExistente = crearDocumentoExistente('aceptado');
    prisma.documentoElectronico.findFirst.mockResolvedValue(docExistente);

    const resultado = await service.emitirCpe(CTX_TEST, VENTA_ID);

    expect(resultado).toBe(docExistente);
    expect(mifactService.enviarCpe).not.toHaveBeenCalled();
    expect(serieCpeService.asignarProximoCorrelativo).not.toHaveBeenCalled();
    expect(prisma.venta.findUnique).not.toHaveBeenCalled();
  });

  // ─── 5. Re-emisión permitida — estado rechazado ──────────────────────────

  it('re-emisión permitida: documento con estado=rechazado → llama a Mifact y asigna nuevo correlativo', async () => {
    const docRechazado = crearDocumentoExistente('rechazado');
    prisma.documentoElectronico.findFirst.mockResolvedValue(docRechazado);
    prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteRuc()));
    mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
    prisma.documentoElectronico.upsert.mockResolvedValue(crearDocumentoExistente('aceptado'));

    const resultado = await service.emitirCpe(CTX_TEST, VENTA_ID);

    expect(mifactService.enviarCpe).toHaveBeenCalledTimes(1);
    expect(serieCpeService.asignarProximoCorrelativo).toHaveBeenCalledTimes(1);
    expect(resultado.estadoSunat).toBe('aceptado');
  });

  // ─── 6. Venta no existe ───────────────────────────────────────────────────

  it('lanza ErrorNoEncontrado cuando la venta no existe', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue(null);

    await expect(service.emitirCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(ErrorNoEncontrado);
    await expect(service.emitirCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(/venta no encontrada/i);
  });

  // ─── 7. Mifact lanza error ────────────────────────────────────────────────

  it('Mifact lanza error: persiste documento con estado=pendiente y mensajeError, re-lanza el error', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteRuc()));
    const errorMifact = new Error('Error de conexión con Mifact');
    mifactService.enviarCpe.mockRejectedValue(errorMifact);
    prisma.documentoElectronico.upsert.mockResolvedValue(crearDocumentoExistente('pendiente'));

    await expect(service.emitirCpe(CTX_TEST, VENTA_ID)).rejects.toThrow('Error de conexión con Mifact');

    expect(prisma.documentoElectronico.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          estadoSunat: 'pendiente',
          ultimoErrorTexto: 'Error de conexión con Mifact',
          numIntentos: 1,
        }),
        update: expect.objectContaining({
          estadoSunat: 'pendiente',
          ultimoErrorTexto: 'Error de conexión con Mifact',
        }),
      }),
    );
  });

  // ─── 8. Mifact responde aceptado_observado ────────────────────────────────

  it('Mifact responde aceptado_observado: persiste con ese estado, aceptadoEn=null', async () => {
    prisma.documentoElectronico.findFirst.mockResolvedValue(null);
    prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteRuc()));
    mifactService.enviarCpe.mockResolvedValue(
      crearRespuestaMifact({ estadoSunat: 'aceptado_observado' }),
    );
    prisma.documentoElectronico.upsert.mockResolvedValue(
      crearDocumentoExistente('aceptado_observado'),
    );

    await service.emitirCpe(CTX_TEST, VENTA_ID);

    expect(prisma.documentoElectronico.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          estadoSunat: 'aceptado_observado',
          aceptadoEn: null,
        }),
        update: expect.objectContaining({
          estadoSunat: 'aceptado_observado',
          aceptadoEn: null,
        }),
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // obtenerPorVentaId
  // ═══════════════════════════════════════════════════════════════════════════

  describe('obtenerPorVentaId', () => {
    it('retorna el documento cuando existe', async () => {
      const doc = crearDocumentoExistente('aceptado');
      prisma.documentoElectronico.findFirst.mockResolvedValue(doc);

      const resultado = await service.obtenerPorVentaId(CTX_TEST, VENTA_ID);

      expect(resultado).toBe(doc);
      expect(prisma.documentoElectronico.findFirst).toHaveBeenCalledWith({
        where: { ventaId: VENTA_ID },
      });
    });

    it('retorna null cuando no existe documento para la venta', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(null);

      const resultado = await service.obtenerPorVentaId(CTX_TEST, VENTA_ID);

      expect(resultado).toBeNull();
      expect(prisma.documentoElectronico.findFirst).toHaveBeenCalledWith({
        where: { ventaId: VENTA_ID },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // reintentarCpe
  // ═══════════════════════════════════════════════════════════════════════════

  describe('reintentarCpe', () => {
    // ─── 1. Happy path desde pendiente ──────────────────────────────────────

    it('happy path desde pendiente: Mifact OK → estado=aceptado, ultimoErrorTexto=null, numIntentos incrementado', async () => {
      const docPendiente = {
        ...crearDocumentoExistente('pendiente'),
        ultimoErrorTexto: 'Error previo de red',
        numIntentos: 1,
        aceptadoEn: null,
      };
      prisma.documentoElectronico.findFirst.mockResolvedValue(docPendiente);
      prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteRuc()));
      mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
      const docActualizado = { ...crearDocumentoExistente('aceptado'), numIntentos: 2, ultimoErrorTexto: null };
      prisma.documentoElectronico.update.mockResolvedValue(docActualizado);

      const resultado = await service.reintentarCpe(CTX_TEST, VENTA_ID);

      expect(resultado.estadoSunat).toBe('aceptado');
      expect(resultado.numIntentos).toBe(2);
      expect(resultado.ultimoErrorTexto).toBeNull();
      expect(prisma.documentoElectronico.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ventaId: VENTA_ID },
          data: expect.objectContaining({
            estadoSunat: 'aceptado',
            ultimoErrorTexto: null,
            numIntentos: { increment: 1 },
            aceptadoEn: expect.any(Date),
          }),
        }),
      );
    });

    // ─── 2. Happy path desde rechazado ──────────────────────────────────────

    it('happy path desde rechazado: Mifact OK → estado=aceptado, ultimoErrorTexto=null', async () => {
      const docRechazado = {
        ...crearDocumentoExistente('rechazado'),
        ultimoErrorTexto: 'SUNAT rechazó el comprobante',
        aceptadoEn: null,
      };
      prisma.documentoElectronico.findFirst.mockResolvedValue(docRechazado);
      prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteRuc()));
      mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
      const docActualizado = { ...crearDocumentoExistente('aceptado'), ultimoErrorTexto: null };
      prisma.documentoElectronico.update.mockResolvedValue(docActualizado);

      const resultado = await service.reintentarCpe(CTX_TEST, VENTA_ID);

      expect(resultado.estadoSunat).toBe('aceptado');
      expect(resultado.ultimoErrorTexto).toBeNull();
    });

    // ─── 3. Sin documento previo → ErrorNoEncontrado ─────────────────────────

    it('lanza ErrorNoEncontrado cuando no hay documento previo', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(null);

      await expect(service.reintentarCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(ErrorNoEncontrado);
      await expect(service.reintentarCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(
        /no hay documento electrónico/i,
      );
    });

    // ─── 4. Documento aceptado → ErrorConflicto ──────────────────────────────

    it('lanza ErrorConflicto cuando el documento ya está aceptado', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(crearDocumentoExistente('aceptado'));

      await expect(service.reintentarCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(ErrorConflicto);
      await expect(service.reintentarCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(
        /ya fue aceptado por SUNAT/i,
      );
    });

    // ─── 5. Documento en_proceso → ErrorConflicto ────────────────────────────

    it('lanza ErrorConflicto cuando el documento está en_proceso, con mensaje sobre consultarEstado', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(crearDocumentoExistente('en_proceso'));

      await expect(service.reintentarCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(ErrorConflicto);
      await expect(service.reintentarCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(
        /consultarEstado/i,
      );
    });

    // ─── 6. Mifact lanza error en reintento ──────────────────────────────────

    it('Mifact lanza error: update con pendiente + ultimoErrorTexto + numIntentos incrementado, re-lanza el error', async () => {
      const docPendiente = { ...crearDocumentoExistente('pendiente'), numIntentos: 1 };
      prisma.documentoElectronico.findFirst.mockResolvedValue(docPendiente);
      prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteRuc()));
      const errorMifact = new Error('Timeout al conectar con Mifact');
      mifactService.enviarCpe.mockRejectedValue(errorMifact);
      prisma.documentoElectronico.update.mockResolvedValue(docPendiente);

      await expect(service.reintentarCpe(CTX_TEST, VENTA_ID)).rejects.toThrow('Timeout al conectar con Mifact');

      expect(prisma.documentoElectronico.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ventaId: VENTA_ID },
          data: expect.objectContaining({
            estadoSunat: 'pendiente',
            ultimoErrorTexto: 'Timeout al conectar con Mifact',
            numIntentos: { increment: 1 },
          }),
        }),
      );
    });

    // ─── 7. Reusa serie/correlativo y NO llama a serieCpeService ─────────────

    it('reusa serie y correlativo del documento existente y no llama a serieCpeService', async () => {
      const docExistente = {
        ...crearDocumentoExistente('pendiente'),
        serie: 'B001',
        correlativo: '00000042',
      };
      prisma.documentoElectronico.findFirst.mockResolvedValue(docExistente);
      prisma.venta.findUnique.mockResolvedValue(crearVenta(crearClienteRuc()));
      mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
      prisma.documentoElectronico.update.mockResolvedValue(crearDocumentoExistente('aceptado'));

      await service.reintentarCpe(CTX_TEST, VENTA_ID);

      expect(serieCpeService.asignarProximoCorrelativo).not.toHaveBeenCalled();
      expect(orquestador.construirCpe).toHaveBeenCalledWith(
        expect.objectContaining({
          venta: expect.objectContaining({
            serie: 'B001',
            correlativo: '00000042',
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // consultarEstadoCpe
  // ═══════════════════════════════════════════════════════════════════════════

  describe('consultarEstadoCpe', () => {
    // ─── 1. Happy path en_proceso → aceptado ────────────────────────────────

    it('en_proceso → aceptado: actualiza estado y setea aceptadoEn', async () => {
      const docEnProceso = {
        ...crearDocumentoExistente('en_proceso'),
        aceptadoEn: null,
        enviadoEn: new Date('2025-05-27T10:00:00Z'),
      };
      prisma.documentoElectronico.findFirst.mockResolvedValue(docEnProceso);
      mifactService.consultarEstado.mockResolvedValue(
        crearRespuestaMifact({ estadoSunat: 'aceptado', sunatDescription: 'Aceptada por SUNAT' }),
      );
      const docActualizado = { ...crearDocumentoExistente('aceptado'), aceptadoEn: new Date() };
      prisma.documentoElectronico.update.mockResolvedValue(docActualizado);

      const resultado = await service.consultarEstadoCpe(CTX_TEST, VENTA_ID);

      expect(resultado.estadoSunat).toBe('aceptado');
      expect(resultado.aceptadoEn).toBeInstanceOf(Date);
      expect(prisma.documentoElectronico.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: docEnProceso.id },
          data: expect.objectContaining({
            estadoSunat: 'aceptado',
            aceptadoEn: expect.any(Date),
          }),
        }),
      );
    });

    // ─── 2. Estado sigue en_proceso ──────────────────────────────────────────

    it('estado sigue en_proceso: aceptadoEn permanece null', async () => {
      const docEnProceso = {
        ...crearDocumentoExistente('en_proceso'),
        aceptadoEn: null,
        enviadoEn: new Date('2025-05-27T10:00:00Z'),
      };
      prisma.documentoElectronico.findFirst.mockResolvedValue(docEnProceso);
      mifactService.consultarEstado.mockResolvedValue(
        crearRespuestaMifact({ estadoSunat: 'en_proceso' }),
      );
      const docSinCambios = { ...docEnProceso };
      prisma.documentoElectronico.update.mockResolvedValue(docSinCambios);

      const resultado = await service.consultarEstadoCpe(CTX_TEST, VENTA_ID);

      expect(resultado.estadoSunat).toBe('en_proceso');
      expect(prisma.documentoElectronico.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estadoSunat: 'en_proceso',
            aceptadoEn: null,
          }),
        }),
      );
    });

    // ─── 3. Sin documento → ErrorNoEncontrado ───────────────────────────────

    it('lanza ErrorNoEncontrado cuando no hay documento previo', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(null);

      await expect(service.consultarEstadoCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(ErrorNoEncontrado);
      await expect(service.consultarEstadoCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(
        /no hay documento electrónico/i,
      );
    });

    // ─── 4. No incrementa numIntentos ────────────────────────────────────────

    it('no incluye numIntentos en el update (consulta, no envío)', async () => {
      const docEnProceso = {
        ...crearDocumentoExistente('en_proceso'),
        aceptadoEn: null,
        enviadoEn: new Date('2025-05-27T10:00:00Z'),
      };
      prisma.documentoElectronico.findFirst.mockResolvedValue(docEnProceso);
      mifactService.consultarEstado.mockResolvedValue(
        crearRespuestaMifact({ estadoSunat: 'aceptado' }),
      );
      prisma.documentoElectronico.update.mockResolvedValue(crearDocumentoExistente('aceptado'));

      await service.consultarEstadoCpe(CTX_TEST, VENTA_ID);

      const llamada = prisma.documentoElectronico.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(llamada.data).not.toHaveProperty('numIntentos');
    });

    // ─── 5. Mifact devuelve estado desconocido (null) ────────────────────────

    it('estado desconocido de Mifact (null): mantiene el estado anterior del documento', async () => {
      const docEnProceso = {
        ...crearDocumentoExistente('en_proceso'),
        aceptadoEn: null,
        enviadoEn: new Date('2025-05-27T10:00:00Z'),
      };
      prisma.documentoElectronico.findFirst.mockResolvedValue(docEnProceso);
      // estadoDocumentoCodigo='999' no está en CODIGO_A_ESTADO_SUNAT → estadoSunat=null
      mifactService.consultarEstado.mockResolvedValue(
        crearRespuestaMifact({ estadoSunat: null as unknown as 'aceptado', sunatDescription: '' }),
      );
      prisma.documentoElectronico.update.mockResolvedValue(docEnProceso);

      const resultado = await service.consultarEstadoCpe(CTX_TEST, VENTA_ID);

      // estadoSunat ?? doc.estadoSunat → mantiene 'en_proceso'
      expect(prisma.documentoElectronico.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estadoSunat: 'en_proceso',
          }),
        }),
      );
      expect(resultado.estadoSunat).toBe('en_proceso');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // emitirCpe — defensa contra nota de venta
  // ═══════════════════════════════════════════════════════════════════════════

  describe('emitirCpe (nota de venta)', () => {
    it('lanza ErrorConflicto si la venta es nota de venta interna y NO toca Mifact ni serie', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(null);
      prisma.venta.findUnique.mockResolvedValue({
        ...crearVenta(crearClienteRuc()),
        numero: 'V-000099',
        esNotaDeVenta: true,
      });

      await expect(service.emitirCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(ErrorConflicto);
      await expect(service.emitirCpe(CTX_TEST, VENTA_ID)).rejects.toThrow(
        /nota de venta interna/i,
      );
      // No debe asignar serie ni llamar a Mifact.
      expect(serieCpeService.asignarProximoCorrelativo).not.toHaveBeenCalled();
      expect(mifactService.enviarCpe).not.toHaveBeenCalled();
      expect(prisma.documentoElectronico.upsert).not.toHaveBeenCalled();
    });

    it('venta normal (esNotaDeVenta=false) → flujo de emisión continúa', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(null);
      prisma.venta.findUnique.mockResolvedValue({
        ...crearVenta(crearClienteRuc()),
        esNotaDeVenta: false,
      });
      mifactService.enviarCpe.mockResolvedValue(crearRespuestaMifact({ estadoSunat: 'aceptado' }));
      prisma.documentoElectronico.upsert.mockResolvedValue(crearDocumentoExistente('aceptado'));

      await expect(service.emitirCpe(CTX_TEST, VENTA_ID)).resolves.toBeDefined();
      expect(mifactService.enviarCpe).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // anularCpeVenta (LowInvoice)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('anularCpeVenta', () => {
    it('happy path: doc aceptado + motivo válido → llama Mifact.anularCpe y persiste baja_pendiente', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(crearDocumentoExistente('aceptado'));
      mifactService.anularCpe.mockResolvedValue(
        crearRespuestaMifact({ estadoSunat: 'baja_pendiente', sunatDescription: 'Baja registrada' }),
      );
      prisma.documentoElectronico.update.mockResolvedValue(crearDocumentoExistente('baja_pendiente'));

      const resultado = await service.anularCpeVenta(CTX_TEST, VENTA_ID, 'Error en datos del receptor');

      expect(mifactService.anularCpe).toHaveBeenCalledWith(
        expect.objectContaining({ baseUrl: expect.any(String), token: 'token-descifrado' }),
        expect.objectContaining({
          NUM_NIF_EMIS: '20100100100',
          COD_TIP_CPE: '01', // factura
          NUM_SERIE_CPE: 'F001',
          NUM_CORRE_CPE: '00000001',
          TXT_DESC_MTVO: 'Error en datos del receptor',
        }),
      );
      expect(prisma.documentoElectronico.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estadoSunat: 'baja_pendiente',
            mensajeSunat: expect.stringContaining('Error en datos del receptor'),
          }),
        }),
      );
      expect(resultado.estadoSunat).toBe('baja_pendiente');
    });

    it('rechaza motivo vacío con ErrorValidacion', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(crearDocumentoExistente('aceptado'));
      await expect(service.anularCpeVenta(CTX_TEST, VENTA_ID, '')).rejects.toThrow(/motivo.*obligatorio/i);
      await expect(service.anularCpeVenta(CTX_TEST, VENTA_ID, '   ')).rejects.toThrow(/motivo.*obligatorio/i);
      expect(mifactService.anularCpe).not.toHaveBeenCalled();
    });

    it('rechaza motivo demasiado corto (< 5 chars)', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(crearDocumentoExistente('aceptado'));
      await expect(service.anularCpeVenta(CTX_TEST, VENTA_ID, 'err')).rejects.toThrow(/motivo/i);
      expect(mifactService.anularCpe).not.toHaveBeenCalled();
    });

    it('rechaza si doc está en estado pendiente (nunca llegó a SUNAT)', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(crearDocumentoExistente('pendiente'));
      await expect(
        service.anularCpeVenta(CTX_TEST, VENTA_ID, 'Motivo válido aquí'),
      ).rejects.toThrow(ErrorConflicto);
      await expect(
        service.anularCpeVenta(CTX_TEST, VENTA_ID, 'Motivo válido aquí'),
      ).rejects.toThrow(/no está en SUNAT|aceptado/i);
      expect(mifactService.anularCpe).not.toHaveBeenCalled();
    });

    it('rechaza si doc está en estado rechazado', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(crearDocumentoExistente('rechazado'));
      await expect(
        service.anularCpeVenta(CTX_TEST, VENTA_ID, 'Motivo válido aquí'),
      ).rejects.toThrow(ErrorConflicto);
    });

    it('rechaza si no hay documento electrónico', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(null);
      await expect(
        service.anularCpeVenta(CTX_TEST, VENTA_ID, 'Motivo válido aquí'),
      ).rejects.toThrow(ErrorNoEncontrado);
    });

    it('acepta también aceptado_observado', async () => {
      prisma.documentoElectronico.findFirst.mockResolvedValue(
        crearDocumentoExistente('aceptado_observado'),
      );
      mifactService.anularCpe.mockResolvedValue(
        crearRespuestaMifact({ estadoSunat: 'baja_pendiente' }),
      );
      prisma.documentoElectronico.update.mockResolvedValue(crearDocumentoExistente('baja_pendiente'));

      await expect(
        service.anularCpeVenta(CTX_TEST, VENTA_ID, 'Motivo válido aquí'),
      ).resolves.toBeDefined();
      expect(mifactService.anularCpe).toHaveBeenCalled();
    });
  });
});
