/**
 * CpeBuilderService — construye el payload JSON para Mifact (OSE SUNAT).
 *
 * Responsabilidad ÚNICA: mapear los datos normalizados del dominio interno
 * al formato SCREAMING_SNAKE_CASE que exige la API REST de Mifact.
 * No realiza llamadas HTTP ni accede a la base de datos.
 */
import { Injectable } from '@nestjs/common';
import {
  CODIGO_TIPO_CPE,
  CODIGO_TIPO_AFECTACION_IGV,
  CODIGO_TIPO_DOC_IDENTIDAD,
} from 'src/core/sunat/codigos';
import {
  ConstruirCpeInput,
  DocReferenciadoInput,
  MifactCpePayload,
  MifactDocReferenciadoPayload,
  MifactItemPayload,
  MifactDatoAdicionalPayload,
  VentaItemInput,
  DatoAdicionalInput,
} from './types';

// ─── Constantes UBL / Mifact ────────────────────────────────────────────────

const TXT_VERS_UBL = '2.1';
const TXT_VERS_ESTRUCT_UBL = '2.0';
/** Código proceso de carga Mifact: '001' = estándar */
const COD_PRCD_CARGA = '001';
/** Código tipo de precio de venta SUNAT: '01' = precio unitario */
const COD_TIP_PRC_VTA = '01';
/** Código tributo IGV SUNAT catálogo 05: 1000 = IGV */
const COD_TRIB_IGV = '1000';

@Injectable()
export class CpeBuilderService {
  // ─── Helpers de formato ───────────────────────────────────────────────────

  /**
   * Formatea un monto monetario como string siempre con 2 decimales.
   * Úsalo para totales de cabecera (MNT_TOT_GRAVADO, MNT_TOT, etc.).
   */
  private formatearMonto(valor: string | number): string {
    return Number(valor).toFixed(2);
  }

  /**
   * Formatea un monto de ítem:
   * - cero → "0.00" (formato SUNAT para valores nulos en NC de corrección)
   * - entero positivo → sin decimales ("500", "90")
   * - fraccionario → con exactamente 2 decimales ("82.60", "12.60")
   *
   * Se usa toFixed(2) para fraccionarios porque los valores llegan pre-redondeados
   * a 2dp desde la calculadora y los goldens Mifact esperan esa precisión.
   */
  private formatearMontoItem(valor: string | number): string {
    const n = Number(valor);
    if (n === 0) return '0.00';
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }

  /**
   * Formatea una cantidad: entero → sin decimales, fraccionario → con decimales.
   */
  private formatearCantidad(valor: string | number): string {
    const n = Number(valor);
    return Number.isInteger(n) ? String(n) : n.toString();
  }

  /**
   * Correlativo con cero a la izquierda hasta 8 dígitos.
   * Si ya viene con 8 caracteres lo devuelve tal cual.
   */
  private formatearCorrelativo(valor: string | number): string {
    return String(valor).padStart(8, '0');
  }

  /**
   * Formatea una fecha como YYYY-MM-DD.
   * Acepta Date o string ISO/YYYY-MM-DD.
   */
  private formatearFecha(valor: Date | string): string {
    if (typeof valor === 'string') {
      // Si ya viene en formato YYYY-MM-DD devolver tal cual
      if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
      return new Date(valor).toISOString().slice(0, 10);
    }
    return valor.toISOString().slice(0, 10);
  }

  // ─── Mapeo de items ───────────────────────────────────────────────────────

  private construirItem(item: VentaItemInput): MifactItemPayload {
    return {
      COD_ITEM: item.codigo,
      COD_UNID_ITEM: item.unidadMedida,
      CANT_UNID_ITEM: this.formatearCantidad(item.cantidad),
      VAL_UNIT_ITEM: this.formatearMontoItem(item.precioSinIgv),
      PRC_VTA_UNIT_ITEM: this.formatearMontoItem(item.precioConIgv),
      VAL_VTA_ITEM: this.formatearMontoItem(item.valorVentaItem),
      MNT_PV_ITEM: this.formatearMontoItem(item.montoPrecioVentaItem),
      COD_TIP_PRC_VTA,
      COD_TIP_AFECT_IGV_ITEM: CODIGO_TIPO_AFECTACION_IGV[item.tipoAfectacionIgv],
      COD_TRIB_IGV_ITEM: COD_TRIB_IGV,
      POR_IGV_ITEM: this.formatearMontoItem(item.porcentajeIgv),
      MNT_IGV_ITEM: this.formatearMontoItem(item.montoIgvItem),
      TXT_DESC_ITEM: item.descripcion,
    };
  }

  // ─── Mapeo de datos adicionales ───────────────────────────────────────────

  private construirDatoAdicional(
    dato: DatoAdicionalInput,
  ): MifactDatoAdicionalPayload {
    return {
      COD_TIP_ADIC_SUNAT: dato.codigoTipo,
      TXT_DESC_ADIC_SUNAT: dato.descripcion,
    };
  }

  // ─── Mapeo de documento referenciado (NC / ND) ────────────────────────────

  private construirDocReferenciado(
    doc: DocReferenciadoInput,
  ): MifactDocReferenciadoPayload {
    return {
      COD_TIP_DOC_REF: doc.tipoDocumento,
      NUM_SERIE_CPE_REF: doc.serie,
      NUM_CORRE_CPE_REF: doc.correlativo,
      FEC_DOC_REF: this.formatearFecha(doc.fechaEmision),
    };
  }

  // ─── Método principal ─────────────────────────────────────────────────────

  /** @deprecated Usa construirCpe — este alias se mantiene por retrocompatibilidad */
  construirFactura(input: ConstruirCpeInput): MifactCpePayload {
    return this.construirCpe(input);
  }

  construirCpe(input: ConstruirCpeInput): MifactCpePayload {
    const { token, emisor, receptor, venta, opciones = {} } = input;

    const {
      enviarASunat = true,
      retornarXmlEnvio = false,
      retornarXmlCdr = false,
      retornarPdf = false,
      formatoImpresion = '001',
    } = opciones;

    const payload: MifactCpePayload = {
      TOKEN: token,
      NUM_NIF_EMIS: emisor.ruc,
      NOM_RZN_SOC_EMIS: emisor.razonSocial,
      NOM_COMER_EMIS: emisor.nombreComercial ?? emisor.razonSocial,
      COD_UBI_EMIS: emisor.ubigeo,
      TXT_DMCL_FISC_EMIS: emisor.direccionFiscal,

      COD_TIP_NIF_RECP: CODIGO_TIPO_DOC_IDENTIDAD[receptor.tipoDocumento],
      NUM_NIF_RECP: receptor.numeroDocumento,
      NOM_RZN_SOC_RECP: receptor.razonSocial,
      TXT_DMCL_FISC_RECEP: receptor.direccion ?? '',

      FEC_EMIS: this.formatearFecha(venta.fechaEmision),
      COD_TIP_CPE: CODIGO_TIPO_CPE[venta.tipoCpe],
      NUM_SERIE_CPE: venta.serie,
      NUM_CORRE_CPE: this.formatearCorrelativo(venta.correlativo),
      COD_MND: venta.moneda ?? 'PEN',
      TIP_CAMBIO: venta.tipoCambio ?? '1.000',
      TXT_CORREO_ENVIO: venta.correoCliente ?? '',

      COD_PRCD_CARGA,

      MNT_TOT_GRAVADO: this.formatearMonto(venta.montoTotalGravado),
      MNT_TOT_TRIB_IGV: this.formatearMonto(venta.montoTotalIgv),
      MNT_TOT: this.formatearMonto(venta.montoTotal),

      COD_PTO_VENTA: venta.codigoPuntoVenta ?? '',
      ENVIAR_A_SUNAT: String(enviarASunat),
      RETORNA_XML_ENVIO: String(retornarXmlEnvio),
      RETORNA_XML_CDR: String(retornarXmlCdr),
      RETORNA_PDF: String(retornarPdf),
      COD_FORM_IMPR: formatoImpresion,

      TXT_VERS_UBL,
      TXT_VERS_ESTRUCT_UBL,
      COD_ANEXO_EMIS: emisor.codigoAnexo ?? '0000',
      COD_TIP_OPE_SUNAT: venta.codigoTipoOperacionSunat ?? '0101',

      items: venta.items.map((item) => this.construirItem(item)),
    };

    // Campos opcionales: solo incluir si están presentes (para no romper toEqual)
    if (venta.placa !== undefined) {
      payload.NUM_PLACA = venta.placa;
    }

    if (venta.datosAdicionales && venta.datosAdicionales.length > 0) {
      payload.datos_adicionales = venta.datosAdicionales.map((d) =>
        this.construirDatoAdicional(d),
      );
    }

    // Campos NC: solo en nota de crédito
    if (venta.codigoTipoNc !== undefined) {
      payload.COD_TIP_NC = venta.codigoTipoNc;
    }

    // Campos ND: solo en nota de débito
    if (venta.codigoTipoNd !== undefined) {
      payload.COD_TIP_ND = venta.codigoTipoNd;
    }

    if (venta.descripcionMotivo !== undefined) {
      payload.TXT_DESC_MTVO = venta.descripcionMotivo;
    }

    if (venta.docsReferenciado && venta.docsReferenciado.length > 0) {
      payload.docs_referenciado = venta.docsReferenciado.map((d) =>
        this.construirDocReferenciado(d),
      );
    }

    // Descuento global: solo si está presente
    if (venta.descuentoGlobal !== undefined) {
      payload.MNT_DSCTO_GLOB = this.formatearMonto(venta.descuentoGlobal);
    }

    if (venta.codigoTipoDescuento !== undefined) {
      payload.COD_TIP_DSCTO = venta.codigoTipoDescuento;
    }

    return payload;
  }
}
