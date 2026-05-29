/**
 * DocumentoElectronicoService — orquestador de emisión de CPE.
 *
 * Soporta dos orígenes: Venta (factura/boleta) y NotaCredito.
 *
 * Flujo (cada origen):
 *   idempotencia → cargar entidad → construir OrquestarCpeInput → enviar a Mifact
 *   → persistir DocumentoElectronico.
 *
 * Si Mifact falla, persiste el documento con estado='pendiente' y re-lanza el error.
 * Idempotente: si ya existe un documento aceptado/en_proceso para la entidad,
 * lo retorna sin volver a emitir.
 *
 * Métodos públicos por origen:
 *   - Venta:        obtenerPorVentaId, emitirCpe, reintentarCpe, consultarEstadoCpe
 *   - NotaCrédito:  obtenerPorNotaCreditoId, emitirCpeNotaCredito,
 *                   reintentarCpeNotaCredito, consultarEstadoCpeNotaCredito
 */
import { Injectable } from '@nestjs/common';
import { PrismaClient, DocumentoElectronico, Prisma } from '@prisma/client';

type VentaConRelaciones = Prisma.VentaGetPayload<{
  include: {
    cliente: true;
    sucursal: true;
    items: { include: { variante: { include: { producto: true } } } };
  };
}>;

type NotaCreditoConRelaciones = Prisma.NotaCreditoGetPayload<{
  include: {
    cliente: true;
    sucursal: true;
    items: {
      include: {
        variante: { include: { producto: true } };
        ventaItem: true;
      };
    };
    venta: { include: { documentoElectronico: true } };
  };
}>;

import { ConfiguracionFacturacionService } from '../configuracion/configuracion-facturacion.service';
import { SerieCpeService } from '../series-cpe/series-cpe.service';
import { CpeOrquestadorService } from '../cpe-orquestador/cpe-orquestador.service';
import { MifactService } from '../mifact/mifact.service';
import { ErrorNoEncontrado, ErrorConflicto, ErrorValidacion } from '../../../core/errors/errores';
import {
  CODIGO_TIPO_CPE,
  CODIGO_TIPO_NOTA_CREDITO,
} from '../../../core/sunat/codigos';
import type { TipoCpe, TipoAfectacionIgv, TipoNotaCredito } from '../../../core/sunat/codigos';
import type { OrquestarCpeInput } from '../cpe-orquestador/types';
import type { ConfiguracionFacturacionResuelta } from '../configuracion/configuracion-facturacion.service';
import type { TipoDocumentoLocal } from '../cpe-builder/types';
import { PrismaTenantService } from '../../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../../core/tenancy/tenant-context';

/** Estados en los que el documento ya fue emitido y no se debe re-emitir. */
const ESTADOS_NO_RE_EMITIR = new Set(['aceptado', 'aceptado_observado', 'en_proceso']);

/** Where para upsert/update del DocumentoElectronico — discrimina por origen. */
type DocumentoWhere = { ventaId: string } | { notaCreditoId: string };

@Injectable()
export class DocumentoElectronicoService {
  constructor(
    private readonly prismaTenancy: PrismaTenantService,
    private readonly configuracionService: ConfiguracionFacturacionService,
    private readonly serieCpeService: SerieCpeService,
    private readonly orquestador: CpeOrquestadorService,
    private readonly mifactService: MifactService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // VENTA — Obtener / Emitir / Reintentar / Consultar
  // ═══════════════════════════════════════════════════════════════════════════

  /** Retorna el DocumentoElectronico de una venta si existe, o null. */
  async obtenerPorVentaId(
    ctx: TenantContext,
    ventaId: string,
  ): Promise<DocumentoElectronico | null> {
    return this.prismaTenancy.forTenant(ctx).documentoElectronico.findFirst({ where: { ventaId } });
  }

  /** Emite el CPE de una venta a SUNAT. Idempotente. */
  async emitirCpe(ctx: TenantContext, ventaId: string): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    const existente = await prisma.documentoElectronico.findFirst({ where: { ventaId } });
    if (existente && ESTADOS_NO_RE_EMITIR.has(existente.estadoSunat)) return existente;

    const venta = await this.cargarVenta(prisma, ventaId);
    // Nota de venta interna: NO se emite CPE bajo ninguna circunstancia.
    // El check constraint en DB ya garantiza que esNotaDeVenta=true ⇒ tipoCpe IS NULL,
    // así que esto es solo defensa en profundidad antes de tocar serie/correlativo.
    if (venta.esNotaDeVenta) {
      throw new ErrorConflicto(
        `La venta ${venta.numero} está marcada como nota de venta interna. ` +
          `Las notas de venta no generan comprobante electrónico ni se envían a SUNAT.`,
      );
    }
    const tipoCpe = this.determinarTipoCpeVenta(venta);
    const config = await this.configuracionService.obtenerConfiguracion(ctx);
    const serieAsignada = await this.serieCpeService.asignarProximoCorrelativo(
      ctx,
      venta.sucursalId,
      tipoCpe,
    );

    const input = this.construirInputVenta({
      venta,
      tipoCpe,
      serie: serieAsignada.serie,
      correlativo: serieAsignada.correlativo,
      config,
    });

    return this.procesarEnvio({
      prisma,
      where: { ventaId },
      documentoExistenteId: existente?.id ?? null,
      input,
      config,
      tipoCpe,
      serie: serieAsignada.serie,
      correlativo: serieAsignada.correlativo,
      usarUpdate: false,
    });
  }

  /** Reintenta el envío reutilizando la misma serie+correlativo. */
  async reintentarCpe(ctx: TenantContext, ventaId: string): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    const doc = await prisma.documentoElectronico.findFirst({ where: { ventaId } });
    if (!doc) {
      throw new ErrorNoEncontrado('No hay documento electrónico para esta venta. Usa emitirCpe primero.');
    }
    this.validarReintento(doc);

    const venta = await this.cargarVenta(prisma, ventaId);
    const config = await this.configuracionService.obtenerConfiguracion(ctx);

    const input = this.construirInputVenta({
      venta,
      tipoCpe: doc.tipoCpe as TipoCpe,
      serie: doc.serie,
      correlativo: doc.correlativo,
      config,
    });

    return this.procesarEnvio({
      prisma,
      where: { ventaId },
      documentoExistenteId: doc.id,
      input,
      config,
      tipoCpe: doc.tipoCpe as TipoCpe,
      serie: doc.serie,
      correlativo: doc.correlativo,
      usarUpdate: true,
    });
  }

  /** Consulta estado en SUNAT y actualiza el documento. No incrementa intentos. */
  async consultarEstadoCpe(ctx: TenantContext, ventaId: string): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);
    const doc = await prisma.documentoElectronico.findFirst({ where: { ventaId } });
    if (!doc) throw new ErrorNoEncontrado('No hay documento electrónico para esta venta.');
    return this.consultarEstadoCore(ctx, prisma, doc);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTA DE CRÉDITO — Obtener / Emitir / Reintentar / Consultar
  // ═══════════════════════════════════════════════════════════════════════════

  /** Retorna el DocumentoElectronico de una NC si existe, o null. */
  async obtenerPorNotaCreditoId(
    ctx: TenantContext,
    notaCreditoId: string,
  ): Promise<DocumentoElectronico | null> {
    return this.prismaTenancy
      .forTenant(ctx)
      .documentoElectronico.findFirst({ where: { notaCreditoId } });
  }

  /**
   * Emite el CPE de una NC a SUNAT.
   *
   * Idempotente. La NC debe tener `tipoCpe`, `serieCpeId`, `correlativo` ya
   * asignados en su creación (ver NotasCreditoService.crear) — sino se asume
   * que el tenant no usa facturación electrónica y se lanza error.
   */
  async emitirCpeNotaCredito(
    ctx: TenantContext,
    notaCreditoId: string,
  ): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    const existente = await prisma.documentoElectronico.findFirst({ where: { notaCreditoId } });
    if (existente && ESTADOS_NO_RE_EMITIR.has(existente.estadoSunat)) return existente;

    const nc = await this.cargarNotaCredito(prisma, notaCreditoId);
    this.validarNcEmitible(nc);

    const config = await this.configuracionService.obtenerConfiguracion(ctx);
    const tipoCpe = nc.tipoCpe as TipoCpe; // 'nota_credito' — garantizado por validarNcEmitible
    const serie = await this.resolverSerieNc(prisma, nc);
    const correlativo = nc.correlativo as string;

    const input = this.construirInputNotaCredito({
      nc,
      serie,
      correlativo,
      config,
    });

    return this.procesarEnvio({
      prisma,
      where: { notaCreditoId },
      documentoExistenteId: existente?.id ?? null,
      input,
      config,
      tipoCpe,
      serie,
      correlativo,
      usarUpdate: false,
    });
  }

  /** Reintenta envío del CPE de una NC reutilizando serie+correlativo. */
  async reintentarCpeNotaCredito(
    ctx: TenantContext,
    notaCreditoId: string,
  ): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    const doc = await prisma.documentoElectronico.findFirst({ where: { notaCreditoId } });
    if (!doc) {
      throw new ErrorNoEncontrado(
        'No hay documento electrónico para esta nota de crédito. Usa emitirCpeNotaCredito primero.',
      );
    }
    this.validarReintento(doc);

    const nc = await this.cargarNotaCredito(prisma, notaCreditoId);
    this.validarNcEmitible(nc);
    const config = await this.configuracionService.obtenerConfiguracion(ctx);
    const serie = await this.resolverSerieNc(prisma, nc);

    const input = this.construirInputNotaCredito({
      nc,
      serie,
      correlativo: doc.correlativo,
      config,
    });

    return this.procesarEnvio({
      prisma,
      where: { notaCreditoId },
      documentoExistenteId: doc.id,
      input,
      config,
      tipoCpe: doc.tipoCpe as TipoCpe,
      serie,
      correlativo: doc.correlativo,
      usarUpdate: true,
    });
  }

  /** Consulta estado en SUNAT del CPE de una NC y actualiza. */
  async consultarEstadoCpeNotaCredito(
    ctx: TenantContext,
    notaCreditoId: string,
  ): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);
    const doc = await prisma.documentoElectronico.findFirst({ where: { notaCreditoId } });
    if (!doc) {
      throw new ErrorNoEncontrado('No hay documento electrónico para esta nota de crédito.');
    }
    return this.consultarEstadoCore(ctx, prisma, doc);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANULACIÓN (LowInvoice) — solicita la baja del CPE a SUNAT
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // La anulación es DISTINTA a emitir una nota de crédito:
  //   - NC = devolución/ajuste comercial (referencia al CPE original, suma a su
  //     contabilidad).
  //   - Anulación (LowInvoice) = deshacer el comprobante en SUNAT como si no
  //     existiera. Se usa para errores serios (RUC equivocado, datos
  //     irreparables del receptor, etc.) que NC no resuelve.
  //
  // Solo se permite sobre CPEs aceptados o aceptado_observado. SUNAT no acepta
  // baja de docs pendientes (que nunca recibió), rechazados (que no existen
  // en sus registros) o ya anulados (estado terminal).

  async anularCpeVenta(
    ctx: TenantContext,
    ventaId: string,
    motivo: string,
  ): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);
    const doc = await prisma.documentoElectronico.findFirst({ where: { ventaId } });
    if (!doc) {
      throw new ErrorNoEncontrado(
        'No hay comprobante electrónico para esta venta. No hay nada que anular.',
      );
    }
    return this.anularCpeCore(ctx, prisma, doc, motivo);
  }

  async anularCpeNotaCredito(
    ctx: TenantContext,
    notaCreditoId: string,
    motivo: string,
  ): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);
    const doc = await prisma.documentoElectronico.findFirst({ where: { notaCreditoId } });
    if (!doc) {
      throw new ErrorNoEncontrado(
        'No hay comprobante electrónico para esta nota de crédito. No hay nada que anular.',
      );
    }
    return this.anularCpeCore(ctx, prisma, doc, motivo);
  }

  /**
   * Núcleo de anulación: valida estado, llama a Mifact LowInvoice, persiste
   * el resultado y conserva el motivo concatenado en `mensajeSunat` para
   * trazabilidad mínima sin agregar columnas nuevas.
   */
  private async anularCpeCore(
    ctx: TenantContext,
    prisma: PrismaClient,
    doc: DocumentoElectronico,
    motivo: string,
  ): Promise<DocumentoElectronico> {
    const motivoLimpio = (motivo ?? '').trim();
    if (motivoLimpio.length < 5) {
      throw new ErrorValidacion(
        'El motivo de anulación es obligatorio (mínimo 5 caracteres). SUNAT lo exige.',
      );
    }
    if (doc.estadoSunat !== 'aceptado' && doc.estadoSunat !== 'aceptado_observado') {
      throw new ErrorConflicto(
        `Solo se puede anular un comprobante aceptado por SUNAT. Estado actual: ` +
          `'${doc.estadoSunat}'. Si está en 'pendiente' o 'rechazado', simplemente NO ` +
          `está en SUNAT y no hay nada que anular.`,
      );
    }

    const config = await this.configuracionService.obtenerConfiguracion(ctx);
    const codigoTipoCpe = CODIGO_TIPO_CPE[doc.tipoCpe as TipoCpe];
    const fechaEmision = (doc.enviadoEn ?? doc.creadoEn).toISOString().slice(0, 10);

    const respuesta = await this.mifactService.anularCpe(
      { baseUrl: config.mifactBaseUrl, token: config.mifactToken },
      {
        NUM_NIF_EMIS: config.ruc,
        FEC_EMIS: fechaEmision,
        COD_TIP_CPE: codigoTipoCpe,
        NUM_SERIE_CPE: doc.serie,
        NUM_CORRE_CPE: doc.correlativo,
        TXT_DESC_MTVO: motivoLimpio,
        COD_PTO_VENTA: 'erp',
      },
    );

    // SUNAT 108 = baja_pendiente (Mifact aceptó la solicitud, esperando respuesta SUNAT).
    // SUNAT 105 = anulado (baja confirmada).
    const nuevoEstado = respuesta.estadoSunat ?? 'baja_pendiente';
    const mensaje = respuesta.sunatDescription
      ? `[Anulación: ${motivoLimpio}] ${respuesta.sunatDescription}`
      : `[Anulación: ${motivoLimpio}]`;

    return prisma.documentoElectronico.update({
      where: { id: doc.id },
      data: {
        estadoSunat: nuevoEstado,
        mensajeSunat: mensaje,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers — Carga + Validación
  // ═══════════════════════════════════════════════════════════════════════════

  private async cargarVenta(prisma: PrismaClient, ventaId: string): Promise<VentaConRelaciones> {
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        cliente: true,
        sucursal: true,
        items: { include: { variante: { include: { producto: true } } } },
      },
    });
    if (!venta) throw new ErrorNoEncontrado('Venta no encontrada');
    return venta;
  }

  private async cargarNotaCredito(
    prisma: PrismaClient,
    notaCreditoId: string,
  ): Promise<NotaCreditoConRelaciones> {
    const nc = await prisma.notaCredito.findUnique({
      where: { id: notaCreditoId },
      include: {
        cliente: true,
        sucursal: true,
        items: { include: { variante: { include: { producto: true } }, ventaItem: true } },
        venta: { include: { documentoElectronico: true } },
      },
    });
    if (!nc) throw new ErrorNoEncontrado('Nota de crédito no encontrada');
    return nc;
  }

  private determinarTipoCpeVenta(venta: VentaConRelaciones): TipoCpe {
    if (!venta.cliente) return 'boleta';
    if (venta.cliente.tipoDocumento === 'ruc') return 'factura';
    return 'boleta';
  }

  private validarNcEmitible(nc: NotaCreditoConRelaciones): void {
    if (nc.estado === 'anulada') {
      throw new ErrorConflicto('No se puede emitir el CPE de una nota de crédito anulada.');
    }
    if (nc.tipoCpe !== 'nota_credito' || !nc.serieCpeId || !nc.correlativo) {
      throw new ErrorConflicto(
        'La nota de crédito no tiene datos SUNAT asignados. Verifica que el tenant tenga ' +
          'facturación electrónica activa y que la NC se haya creado correctamente.',
      );
    }
    if (
      !nc.tipoCpeOriginal ||
      !nc.serieCpeOriginal ||
      !nc.correlativoCpeOriginal
    ) {
      throw new ErrorConflicto(
        'La nota de crédito no tiene referencia al CPE original (factura/boleta).',
      );
    }
  }

  private validarReintento(doc: DocumentoElectronico): void {
    if (doc.estadoSunat === 'aceptado' || doc.estadoSunat === 'aceptado_observado') {
      throw new ErrorConflicto('El documento ya fue aceptado por SUNAT. No se puede reintentar.');
    }
    if (doc.estadoSunat === 'en_proceso') {
      throw new ErrorConflicto(
        'El documento está en proceso en SUNAT. Usa consultarEstado para refrescar el estado.',
      );
    }
  }

  private async resolverSerieNc(
    prisma: PrismaClient,
    nc: NotaCreditoConRelaciones,
  ): Promise<string> {
    // serieCpeId está garantizado por validarNcEmitible
    const serie = await prisma.serieCpe.findUnique({
      where: { id: nc.serieCpeId as string },
      select: { serie: true },
    });
    if (!serie) {
      throw new ErrorValidacion(
        'La serie de NC asociada ya no existe. Configura las series en Configuración → Series.',
      );
    }
    return serie.serie;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers — Construcción del OrquestarCpeInput
  // ═══════════════════════════════════════════════════════════════════════════

  private construirReceptor(cliente: VentaConRelaciones['cliente']): OrquestarCpeInput['receptor'] {
    return cliente
      ? {
          tipoDocumento: cliente.tipoDocumento as TipoDocumentoLocal,
          numeroDocumento: cliente.documento ?? '00000000',
          razonSocial: cliente.nombre,
          direccion: cliente.direccion ?? undefined,
        }
      : {
          tipoDocumento: 'dni' as TipoDocumentoLocal,
          numeroDocumento: '00000000',
          razonSocial: 'VARIOS',
        };
  }

  private construirEmisor(config: ConfiguracionFacturacionResuelta): OrquestarCpeInput['emisor'] {
    return {
      ruc: config.ruc,
      razonSocial: config.razonSocial,
      nombreComercial: config.nombreComercial ?? undefined,
      ubigeo: config.ubigeoFiscalCodigo,
      direccionFiscal: config.direccionFiscal,
      codigoAnexo: '0000',
    };
  }

  private opcionesMifact(config: ConfiguracionFacturacionResuelta): OrquestarCpeInput['opciones'] {
    return {
      enviarASunat: config.enviarAutomaticoASunat,
      retornarPdf: config.retornarPdf,
      retornarXmlEnvio: config.retornarXmlEnvio,
      retornarXmlCdr: config.retornarXmlCdr,
      formatoImpresion: config.formatoImpresion,
    };
  }

  private construirInputVenta(params: {
    venta: VentaConRelaciones;
    tipoCpe: TipoCpe;
    serie: string;
    correlativo: string;
    config: ConfiguracionFacturacionResuelta;
  }): OrquestarCpeInput {
    const { venta, tipoCpe, serie, correlativo, config } = params;
    return {
      token: config.mifactToken,
      emisor: this.construirEmisor(config),
      receptor: this.construirReceptor(venta.cliente),
      venta: {
        tipoCpe,
        serie,
        correlativo,
        fechaEmision: (venta.creadoEn as Date).toISOString().slice(0, 10),
        moneda: venta.moneda ?? 'PEN',
        tipoCambio: venta.tipoCambio?.toString() ?? '1.000',
        correoCliente: venta.cliente?.email ?? undefined,
        codigoPuntoVenta: venta.sucursal.codigo,
        codigoTipoOperacionSunat: venta.codigoTipoOperacionSunat ?? '0101',
        items: venta.items.map((item) => ({
          codigo: item.variante.sku,
          descripcion: item.descripcion,
          unidadMedida: item.variante.producto.unidadMedidaCodigo ?? 'NIU',
          cantidad: item.cantidad,
          precioUnitarioConIgv: item.precioUnitario.toString(),
          tipoAfectacionIgv: item.variante.producto.tipoAfectacionIgv as TipoAfectacionIgv,
        })),
      },
      opciones: this.opcionesMifact(config),
    };
  }

  private construirInputNotaCredito(params: {
    nc: NotaCreditoConRelaciones;
    serie: string;
    correlativo: string;
    config: ConfiguracionFacturacionResuelta;
  }): OrquestarCpeInput {
    const { nc, serie, correlativo, config } = params;
    const codigoTipoNc = CODIGO_TIPO_NOTA_CREDITO[nc.codigoTipoNc as TipoNotaCredito];
    const codigoTipoDocOriginal = CODIGO_TIPO_CPE[nc.tipoCpeOriginal as TipoCpe];
    const fechaEmisionOriginal = (nc.venta.creadoEn as Date).toISOString().slice(0, 10);

    return {
      token: config.mifactToken,
      emisor: this.construirEmisor(config),
      receptor: this.construirReceptor(nc.cliente),
      venta: {
        tipoCpe: 'nota_credito',
        serie,
        correlativo,
        fechaEmision: (nc.creadoEn as Date).toISOString().slice(0, 10),
        moneda: nc.venta.moneda ?? 'PEN',
        tipoCambio: nc.venta.tipoCambio?.toString() ?? '1.000',
        correoCliente: nc.cliente?.email ?? undefined,
        codigoPuntoVenta: nc.sucursal.codigo,
        codigoTipoOperacionSunat: '0101',
        items: nc.items.map((item) => ({
          codigo: item.variante.sku,
          descripcion: item.descripcion,
          unidadMedida: item.variante.producto.unidadMedidaCodigo ?? 'NIU',
          cantidad: item.cantidad,
          precioUnitarioConIgv: item.precioUnitario.toString(),
          tipoAfectacionIgv: item.variante.producto.tipoAfectacionIgv as TipoAfectacionIgv,
        })),
        codigoTipoNc,
        descripcionMotivo: nc.motivo,
        docsReferenciado: [
          {
            tipoDocumento: codigoTipoDocOriginal,
            serie: nc.serieCpeOriginal as string,
            correlativo: nc.correlativoCpeOriginal as string,
            fechaEmision: fechaEmisionOriginal,
          },
        ],
      },
      opciones: this.opcionesMifact(config),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers — Envío + Persistencia
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Envía a Mifact y persiste el resultado. Polimorfico por `where`:
   * usa `{ventaId}` o `{notaCreditoId}` indistintamente para upsert/update.
   */
  private async procesarEnvio(params: {
    prisma: PrismaClient;
    where: DocumentoWhere;
    documentoExistenteId: string | null;
    input: OrquestarCpeInput;
    config: ConfiguracionFacturacionResuelta;
    tipoCpe: TipoCpe;
    serie: string;
    correlativo: string;
    usarUpdate: boolean;
  }): Promise<DocumentoElectronico> {
    const { prisma, where, input, config, tipoCpe, serie, correlativo, usarUpdate } = params;

    const payload = this.orquestador.construirCpe(input);

    let respuesta;
    try {
      respuesta = await this.mifactService.enviarCpe(
        { baseUrl: config.mifactBaseUrl, token: config.mifactToken },
        payload,
      );
    } catch (err) {
      // Error de red / Mifact: persistir con estado pendiente y re-lanzar.
      // enviadoEn se actualiza siempre — representa "última vez que se intentó
      // contactar a Mifact", no "última vez exitosa". El cron de pendientes
      // calcula su backoff desde este timestamp.
      if (usarUpdate) {
        await prisma.documentoElectronico.update({
          where: where as Prisma.DocumentoElectronicoWhereUniqueInput,
          data: {
            estadoSunat: 'pendiente',
            ultimoErrorTexto: (err as Error).message,
            numIntentos: { increment: 1 },
            enviadoEn: new Date(),
          },
        });
      } else {
        await prisma.documentoElectronico.upsert({
          where: where as Prisma.DocumentoElectronicoWhereUniqueInput,
          create: {
            ...where,
            tipoCpe,
            serie,
            correlativo,
            estadoSunat: 'pendiente',
            ultimoErrorTexto: (err as Error).message,
            numIntentos: 1,
            enviadoEn: new Date(),
          },
          update: {
            estadoSunat: 'pendiente',
            ultimoErrorTexto: (err as Error).message,
            numIntentos: { increment: 1 },
            enviadoEn: new Date(),
          },
        });
      }
      throw err;
    }

    // Persistir respuesta exitosa
    if (usarUpdate) {
      return prisma.documentoElectronico.update({
        where: where as Prisma.DocumentoElectronicoWhereUniqueInput,
        data: this.dataExitosa(respuesta),
      });
    }

    return prisma.documentoElectronico.upsert({
      where: where as Prisma.DocumentoElectronicoWhereUniqueInput,
      create: {
        ...where,
        tipoCpe,
        serie,
        correlativo,
        ...this.dataExitosaCreate(respuesta),
      },
      update: this.dataExitosa(respuesta),
    });
  }

  private dataExitosa(respuesta: {
    estadoSunat?: string | null;
    codigoHash?: string | null;
    cadenaParaCodigoQr?: string | null;
    sunatDescription?: string | null;
  }) {
    return {
      estadoSunat: (respuesta.estadoSunat ?? 'pendiente') as Prisma.DocumentoElectronicoUpdateInput['estadoSunat'],
      codigoHash: respuesta.codigoHash || null,
      cadenaQr: respuesta.cadenaParaCodigoQr || null,
      mensajeSunat: respuesta.sunatDescription || null,
      ultimoErrorTexto: null,
      numIntentos: { increment: 1 },
      enviadoEn: new Date(),
      aceptadoEn: respuesta.estadoSunat === 'aceptado' ? new Date() : null,
    } satisfies Prisma.DocumentoElectronicoUpdateInput;
  }

  private dataExitosaCreate(respuesta: {
    estadoSunat?: string | null;
    codigoHash?: string | null;
    cadenaParaCodigoQr?: string | null;
    sunatDescription?: string | null;
  }) {
    return {
      estadoSunat: (respuesta.estadoSunat ?? 'pendiente') as Prisma.DocumentoElectronicoCreateInput['estadoSunat'],
      codigoHash: respuesta.codigoHash || null,
      cadenaQr: respuesta.cadenaParaCodigoQr || null,
      mensajeSunat: respuesta.sunatDescription || null,
      numIntentos: 1,
      enviadoEn: new Date(),
      aceptadoEn: respuesta.estadoSunat === 'aceptado' ? new Date() : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers — Consulta de estado (compartida venta + NC)
  // ═══════════════════════════════════════════════════════════════════════════

  private async consultarEstadoCore(
    ctx: TenantContext,
    prisma: PrismaClient,
    doc: DocumentoElectronico,
  ): Promise<DocumentoElectronico> {
    const config = await this.configuracionService.obtenerConfiguracion(ctx);
    const codigoTipoCpe = CODIGO_TIPO_CPE[doc.tipoCpe as TipoCpe];
    const fechaEmision = (doc.enviadoEn ?? doc.creadoEn).toISOString().slice(0, 10);

    const respuesta = await this.mifactService.consultarEstado(
      { baseUrl: config.mifactBaseUrl, token: config.mifactToken },
      {
        NUM_NIF_EMIS: config.ruc,
        COD_TIP_CPE: codigoTipoCpe,
        NUM_SERIE_CPE: doc.serie,
        NUM_CORRE_CPE: doc.correlativo,
        FEC_EMIS: fechaEmision,
      },
    );

    const nuevoEstado = respuesta.estadoSunat ?? doc.estadoSunat;
    const aceptadoEn =
      respuesta.estadoSunat === 'aceptado' && !doc.aceptadoEn ? new Date() : doc.aceptadoEn;

    return prisma.documentoElectronico.update({
      where: { id: doc.id },
      data: {
        estadoSunat: nuevoEstado,
        mensajeSunat: respuesta.sunatDescription || doc.mensajeSunat,
        aceptadoEn,
      },
    });
  }
}
