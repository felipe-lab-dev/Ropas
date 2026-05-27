/**
 * DocumentoElectronicoService — orquestador de emisión de CPE.
 *
 * Flujo: idempotencia → cargar venta → determinar tipo CPE → cargar config →
 * asignar correlativo → construir payload → enviar a Mifact → persistir resultado.
 *
 * Si Mifact falla, persiste el documento con estado='pendiente' y re-lanza el error.
 * El servicio es idempotente: si ya existe un documento aceptado/en_proceso para
 * la venta, lo retorna sin volver a emitir.
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
import { ConfiguracionFacturacionService } from '../configuracion/configuracion-facturacion.service';
import { SerieCpeService } from '../series-cpe/series-cpe.service';
import { CpeOrquestadorService } from '../cpe-orquestador/cpe-orquestador.service';
import { MifactService } from '../mifact/mifact.service';
import { ErrorNoEncontrado, ErrorConflicto } from '../../../core/errors/errores';
import { CODIGO_TIPO_CPE } from '../../../core/sunat/codigos';
import type { TipoCpe, TipoAfectacionIgv } from '../../../core/sunat/codigos';
import type { OrquestarCpeInput } from '../cpe-orquestador/types';
import type { ConfiguracionFacturacionResuelta } from '../configuracion/configuracion-facturacion.service';
import type { TipoDocumentoLocal } from '../cpe-builder/types';
import { PrismaTenantService } from '../../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../../core/tenancy/tenant-context';

// Estados que indican que el documento ya fue emitido exitosamente y no debe re-emitirse
const ESTADOS_NO_RE_EMITIR = new Set(['aceptado', 'aceptado_observado', 'en_proceso']);

@Injectable()
export class DocumentoElectronicoService {
  constructor(
    private readonly prismaTenancy: PrismaTenantService,
    private readonly configuracionService: ConfiguracionFacturacionService,
    private readonly serieCpeService: SerieCpeService,
    private readonly orquestador: CpeOrquestadorService,
    private readonly mifactService: MifactService,
  ) {}

  /**
   * Retorna el DocumentoElectronico de una venta si existe, o null.
   * NO lanza ErrorNoEncontrado — es válido que una venta no tenga documento todavía.
   */
  async obtenerPorVentaId(ctx: TenantContext, ventaId: string): Promise<DocumentoElectronico | null> {
    return this.prismaTenancy.forTenant(ctx).documentoElectronico.findFirst({ where: { ventaId } });
  }

  /**
   * Emite el CPE de una venta a SUNAT vía Mifact.
   * Idempotente: si ya existe un DocumentoElectronico para esa venta con estado
   * aceptado, aceptado_observado o en_proceso, lo retorna sin re-emitir.
   */
  async emitirCpe(ctx: TenantContext, ventaId: string): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    // 1. Idempotencia
    const existente = await prisma.documentoElectronico.findFirst({
      where: { ventaId },
    });
    if (existente && ESTADOS_NO_RE_EMITIR.has(existente.estadoSunat)) {
      return existente;
    }

    // 2. Cargar venta con relations
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        cliente: true,
        sucursal: true,
        items: {
          include: {
            variante: {
              include: { producto: true },
            },
          },
        },
      },
    });

    if (!venta) {
      throw new ErrorNoEncontrado('Venta no encontrada');
    }

    // 3. Determinar tipoCpe según receptor
    let tipoCpe: TipoCpe;
    if (!venta.cliente) {
      tipoCpe = 'boleta';
    } else if (venta.cliente.tipoDocumento === 'ruc') {
      tipoCpe = 'factura';
    } else {
      tipoCpe = 'boleta';
    }

    // 4. Cargar configuración del tenant
    const config = await this.configuracionService.obtenerConfiguracion(ctx);

    // 5. Asignar serie + correlativo (incremento atómico)
    const serieAsignada = await this.serieCpeService.asignarProximoCorrelativo(
      ctx,
      venta.sucursalId,
      tipoCpe,
    );

    // 6. Enviar a Mifact y persistir resultado (upsert — puede ser primera vez o reintento de emitirCpe)
    return this.procesarEnvio({
      ctx,
      prisma,
      ventaId,
      documentoExistenteId: existente?.id ?? null,
      venta,
      tipoCpe,
      serie: serieAsignada.serie,
      correlativo: serieAsignada.correlativo,
      config,
      usarUpdate: false,
    });
  }

  /**
   * Reintenta el envío de un CPE previamente registrado, reutilizando la misma
   * serie y correlativo. Solo válido para estados 'pendiente' y 'rechazado'.
   */
  async reintentarCpe(ctx: TenantContext, ventaId: string): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    // 1. Buscar documento existente
    const doc = await prisma.documentoElectronico.findFirst({
      where: { ventaId },
    });

    if (!doc) {
      throw new ErrorNoEncontrado(
        'No hay documento electrónico para esta venta. Usa emitirCpe primero.',
      );
    }

    // 2. Validar estado actual
    if (doc.estadoSunat === 'aceptado' || doc.estadoSunat === 'aceptado_observado') {
      throw new ErrorConflicto(
        'El documento ya fue aceptado por SUNAT. No se puede reintentar.',
      );
    }
    if (doc.estadoSunat === 'en_proceso') {
      throw new ErrorConflicto(
        'El documento está en proceso en SUNAT. Usa consultarEstadoCpe para refrescar el estado.',
      );
    }

    // 3. Cargar venta con relations
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        cliente: true,
        sucursal: true,
        items: {
          include: {
            variante: {
              include: { producto: true },
            },
          },
        },
      },
    });

    if (!venta) {
      throw new ErrorNoEncontrado('Venta no encontrada');
    }

    // 4. Cargar configuración del tenant
    const config = await this.configuracionService.obtenerConfiguracion(ctx);

    // 5. Enviar reutilizando serie + correlativo del documento existente
    return this.procesarEnvio({
      ctx,
      prisma,
      ventaId,
      documentoExistenteId: doc.id,
      venta,
      tipoCpe: doc.tipoCpe as TipoCpe,
      serie: doc.serie,
      correlativo: doc.correlativo,
      config,
      usarUpdate: true,
    });
  }

  /**
   * Consulta el estado actual de un CPE en Mifact/SUNAT y actualiza el documento.
   * No incrementa numIntentos (es solo consulta, no nuevo envío).
   */
  async consultarEstadoCpe(ctx: TenantContext, ventaId: string): Promise<DocumentoElectronico> {
    const prisma = this.prismaTenancy.forTenant(ctx);

    // 1. Buscar documento existente
    const doc = await prisma.documentoElectronico.findFirst({
      where: { ventaId },
    });

    if (!doc) {
      throw new ErrorNoEncontrado(
        'No hay documento electrónico para esta venta.',
      );
    }

    // 2. Cargar configuración
    const config = await this.configuracionService.obtenerConfiguracion(ctx);

    // 3. Consultar estado en Mifact
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

    // 4. Actualizar documento con nuevo estado
    const nuevoEstado = respuesta.estadoSunat ?? doc.estadoSunat;
    const aceptadoEn =
      respuesta.estadoSunat === 'aceptado' && !doc.aceptadoEn
        ? new Date()
        : doc.aceptadoEn;

    const documentoActualizado = await prisma.documentoElectronico.update({
      where: { id: doc.id },
      data: {
        estadoSunat: nuevoEstado,
        mensajeSunat: respuesta.sunatDescription || doc.mensajeSunat,
        aceptadoEn,
      },
    });

    return documentoActualizado;
  }

  // ─── Helper privado ──────────────────────────────────────────────────────────

  /**
   * Construye el OrquestarCpeInput, llama al orquestador y a Mifact, y persiste
   * el resultado. Compartido entre emitirCpe y reintentarCpe.
   *
   * @param usarUpdate  Si true, usa `update` directo (reintento — el doc ya existe).
   *                    Si false, usa `upsert` create+update (primera emisión).
   */
  private async procesarEnvio(params: {
    ctx: TenantContext;
    prisma: PrismaClient;
    ventaId: string;
    documentoExistenteId: string | null;
    venta: VentaConRelaciones;
    tipoCpe: TipoCpe;
    serie: string;
    correlativo: string;
    config: ConfiguracionFacturacionResuelta;
    usarUpdate: boolean;
  }): Promise<DocumentoElectronico> {
    const { prisma, ventaId, venta, tipoCpe, serie, correlativo, config, usarUpdate } = params;

    // Construir receptor
    const receptor: OrquestarCpeInput['receptor'] = venta.cliente
      ? {
          tipoDocumento: venta.cliente.tipoDocumento as TipoDocumentoLocal,
          numeroDocumento: venta.cliente.documento ?? '00000000',
          razonSocial: venta.cliente.nombre,
          direccion: venta.cliente.direccion ?? undefined,
        }
      : {
          tipoDocumento: 'dni' as TipoDocumentoLocal,
          numeroDocumento: '00000000',
          razonSocial: 'VARIOS',
        };

    const input: OrquestarCpeInput = {
      token: config.mifactToken,
      emisor: {
        ruc: config.ruc,
        razonSocial: config.razonSocial,
        nombreComercial: config.nombreComercial ?? undefined,
        ubigeo: config.ubigeoFiscalCodigo,
        direccionFiscal: config.direccionFiscal,
        codigoAnexo: '0000',
      },
      receptor,
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
      opciones: {
        enviarASunat: config.enviarAutomaticoASunat,
        retornarPdf: config.retornarPdf,
        retornarXmlEnvio: config.retornarXmlEnvio,
        retornarXmlCdr: config.retornarXmlCdr,
        formatoImpresion: config.formatoImpresion,
      },
    };

    // Construir payload CPE
    const payload = this.orquestador.construirCpe(input);

    // Enviar a Mifact
    let respuesta;
    try {
      respuesta = await this.mifactService.enviarCpe(
        { baseUrl: config.mifactBaseUrl, token: config.mifactToken },
        payload,
      );
    } catch (err) {
      // Error de red / Mifact: persistir con estado pendiente y re-lanzar
      if (usarUpdate) {
        await prisma.documentoElectronico.update({
          where: { ventaId },
          data: {
            estadoSunat: 'pendiente',
            ultimoErrorTexto: (err as Error).message,
            numIntentos: { increment: 1 },
          },
        });
      } else {
        await prisma.documentoElectronico.upsert({
          where: { ventaId },
          create: {
            ventaId,
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
        where: { ventaId },
        data: {
          estadoSunat: respuesta.estadoSunat ?? 'pendiente',
          codigoHash: respuesta.codigoHash || null,
          cadenaQr: respuesta.cadenaParaCodigoQr || null,
          mensajeSunat: respuesta.sunatDescription || null,
          ultimoErrorTexto: null,
          numIntentos: { increment: 1 },
          enviadoEn: new Date(),
          aceptadoEn: respuesta.estadoSunat === 'aceptado' ? new Date() : null,
        },
      });
    }

    return prisma.documentoElectronico.upsert({
      where: { ventaId },
      create: {
        ventaId,
        tipoCpe,
        serie,
        correlativo,
        estadoSunat: respuesta.estadoSunat ?? 'pendiente',
        codigoHash: respuesta.codigoHash || null,
        cadenaQr: respuesta.cadenaParaCodigoQr || null,
        mensajeSunat: respuesta.sunatDescription || null,
        numIntentos: 1,
        enviadoEn: new Date(),
        aceptadoEn: respuesta.estadoSunat === 'aceptado' ? new Date() : null,
      },
      update: {
        estadoSunat: respuesta.estadoSunat ?? 'pendiente',
        codigoHash: respuesta.codigoHash || null,
        cadenaQr: respuesta.cadenaParaCodigoQr || null,
        mensajeSunat: respuesta.sunatDescription || null,
        numIntentos: { increment: 1 },
        enviadoEn: new Date(),
        aceptadoEn: respuesta.estadoSunat === 'aceptado' ? new Date() : null,
      },
    });
  }
}
