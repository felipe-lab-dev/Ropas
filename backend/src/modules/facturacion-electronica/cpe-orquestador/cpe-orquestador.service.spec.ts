/**
 * Test de integración: CpeOrquestadorService = Calculadora + Builder.
 *
 * Usa los goldens de Mifact como fuente de verdad. Los goldens contienen campos
 * extra que el builder no emite (MNT_BRUTO, DET_VAL_ADIC01-04, FEC_VENCIMIENTO,
 * COD_TIP_NIF_EMIS). `proyectarCamposCpe` extrae solo los campos que nuestro
 * builder produce, haciendo la comparación robusta ante esos extras.
 */
import * as fs from 'fs';
import * as path from 'path';
import { CpeBuilderService } from '../cpe-builder/cpe-builder.service';
import type { MifactCpePayload } from '../cpe-builder/types';
import { CpeCalculadoraService } from '../cpe-calculadora/cpe-calculadora.service';
import { CpeOrquestadorService } from './cpe-orquestador.service';
import type { OrquestarCpeInput } from './types';

// ─── Helpers de golden ────────────────────────────────────────────────────────

function stripJsComments(src: string): string {
  let result = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      result += src[i++];
      while (i < src.length) {
        if (src[i] === '\\') {
          result += src[i++];
          result += src[i++];
          continue;
        }
        if (src[i] === '"') {
          result += src[i++];
          break;
        }
        result += src[i++];
      }
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    result += src[i++];
  }
  return result;
}

function cargarGolden(filename: string): MifactCpePayload {
  const goldenDir = path.resolve(
    __dirname,
    '..', '..', '..', '..', '..',
    'facturacion',
    'integracionConJson_FV_BV_NC_ND',
    'Ejemplos Archivos JSON UBL 2_1',
  );
  const raw = fs.readFileSync(path.join(goldenDir, filename), 'utf-8');
  return JSON.parse(stripJsComments(raw)) as MifactCpePayload;
}

/**
 * Extrae solo los campos que nuestro builder emite, eliminando campos extra
 * del golden que Mifact acepta pero nosotros no generamos aún
 * (MNT_BRUTO, DET_VAL_ADIC01-04, FEC_VENCIMIENTO, COD_TIP_NIF_EMIS).
 */
function proyectarCamposCpe(golden: MifactCpePayload): MifactCpePayload {
  const cabecera: Omit<MifactCpePayload, 'items' | 'datos_adicionales' | 'docs_referenciado'> = {
    TOKEN: golden.TOKEN,
    NUM_NIF_EMIS: golden.NUM_NIF_EMIS,
    NOM_RZN_SOC_EMIS: golden.NOM_RZN_SOC_EMIS,
    NOM_COMER_EMIS: golden.NOM_COMER_EMIS,
    COD_UBI_EMIS: golden.COD_UBI_EMIS,
    TXT_DMCL_FISC_EMIS: golden.TXT_DMCL_FISC_EMIS,
    COD_TIP_NIF_RECP: golden.COD_TIP_NIF_RECP,
    NUM_NIF_RECP: golden.NUM_NIF_RECP,
    NOM_RZN_SOC_RECP: golden.NOM_RZN_SOC_RECP,
    TXT_DMCL_FISC_RECEP: golden.TXT_DMCL_FISC_RECEP,
    FEC_EMIS: golden.FEC_EMIS,
    COD_TIP_CPE: golden.COD_TIP_CPE,
    NUM_SERIE_CPE: golden.NUM_SERIE_CPE,
    NUM_CORRE_CPE: golden.NUM_CORRE_CPE,
    COD_MND: golden.COD_MND,
    // TIP_CAMBIO: el golden NC-anulación no lo incluye pero nuestro builder siempre lo emite ('1.000' por defecto)
    TIP_CAMBIO: golden.TIP_CAMBIO ?? '1.000',
    TXT_CORREO_ENVIO: golden.TXT_CORREO_ENVIO,
    COD_PRCD_CARGA: golden.COD_PRCD_CARGA,
    MNT_TOT_GRAVADO: golden.MNT_TOT_GRAVADO,
    MNT_TOT_TRIB_IGV: golden.MNT_TOT_TRIB_IGV,
    MNT_TOT: golden.MNT_TOT,
    COD_PTO_VENTA: golden.COD_PTO_VENTA,
    ENVIAR_A_SUNAT: golden.ENVIAR_A_SUNAT,
    RETORNA_XML_ENVIO: golden.RETORNA_XML_ENVIO,
    RETORNA_XML_CDR: golden.RETORNA_XML_CDR,
    RETORNA_PDF: golden.RETORNA_PDF,
    COD_FORM_IMPR: golden.COD_FORM_IMPR,
    TXT_VERS_UBL: golden.TXT_VERS_UBL,
    TXT_VERS_ESTRUCT_UBL: golden.TXT_VERS_ESTRUCT_UBL,
    COD_ANEXO_EMIS: golden.COD_ANEXO_EMIS,
    COD_TIP_OPE_SUNAT: golden.COD_TIP_OPE_SUNAT,
  };

  const resultado: MifactCpePayload = {
    ...cabecera,
    // Items: proyectar solo campos de MifactItemPayload
    items: golden.items.map((item) => ({
      COD_ITEM: item.COD_ITEM,
      COD_UNID_ITEM: item.COD_UNID_ITEM,
      CANT_UNID_ITEM: item.CANT_UNID_ITEM,
      VAL_UNIT_ITEM: item.VAL_UNIT_ITEM,
      PRC_VTA_UNIT_ITEM: item.PRC_VTA_UNIT_ITEM,
      VAL_VTA_ITEM: item.VAL_VTA_ITEM,
      MNT_PV_ITEM: item.MNT_PV_ITEM,
      COD_TIP_PRC_VTA: item.COD_TIP_PRC_VTA,
      COD_TIP_AFECT_IGV_ITEM: item.COD_TIP_AFECT_IGV_ITEM,
      COD_TRIB_IGV_ITEM: item.COD_TRIB_IGV_ITEM,
      POR_IGV_ITEM: item.POR_IGV_ITEM,
      MNT_IGV_ITEM: item.MNT_IGV_ITEM,
      TXT_DESC_ITEM: item.TXT_DESC_ITEM,
    })),
  };

  // Campos opcionales de cabecera: solo si el golden los tiene
  if (golden.NUM_PLACA !== undefined) {
    resultado.NUM_PLACA = golden.NUM_PLACA;
  }
  if (golden.COD_TIP_NC !== undefined) {
    resultado.COD_TIP_NC = golden.COD_TIP_NC;
  }
  if (golden.COD_TIP_ND !== undefined) {
    resultado.COD_TIP_ND = golden.COD_TIP_ND;
  }
  if (golden.TXT_DESC_MTVO !== undefined) {
    resultado.TXT_DESC_MTVO = golden.TXT_DESC_MTVO;
  }
  if (golden.MNT_DSCTO_GLOB !== undefined) {
    resultado.MNT_DSCTO_GLOB = golden.MNT_DSCTO_GLOB;
  }
  if (golden.COD_TIP_DSCTO !== undefined) {
    resultado.COD_TIP_DSCTO = golden.COD_TIP_DSCTO;
  }
  if (golden.datos_adicionales && golden.datos_adicionales.length > 0) {
    resultado.datos_adicionales = golden.datos_adicionales.map((d) => ({
      COD_TIP_ADIC_SUNAT: d.COD_TIP_ADIC_SUNAT,
      TXT_DESC_ADIC_SUNAT: d.TXT_DESC_ADIC_SUNAT,
    }));
  }
  if (golden.docs_referenciado && golden.docs_referenciado.length > 0) {
    resultado.docs_referenciado = golden.docs_referenciado.map((d) => ({
      COD_TIP_DOC_REF: d.COD_TIP_DOC_REF,
      NUM_SERIE_CPE_REF: d.NUM_SERIE_CPE_REF,
      NUM_CORRE_CPE_REF: d.NUM_CORRE_CPE_REF,
      FEC_DOC_REF: d.FEC_DOC_REF,
    }));
  }

  return resultado;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CpeOrquestadorService (integración Calculadora + Builder)', () => {
  const calculadora = new CpeCalculadoraService();
  const builder = new CpeBuilderService();
  const orquestador = new CpeOrquestadorService(calculadora, builder);

  // ── Caso 1: Factura tradicional (caso base existente) ─────────────────────

  it('reproduce el golden Factura_con_IGV_TRADICIONAL desde input dominio', () => {
    const expected = proyectarCamposCpe(cargarGolden('Factura_con_IGV_TRADICIONAL.txt'));

    const input: OrquestarCpeInput = {
      token: 'gN8zNRBV+/FVxTLwdaZx0w==',
      emisor: {
        ruc: '20100100100',
        razonSocial: 'empresa demo',
        nombreComercial: 'mi nombre comercial es demo',
        ubigeo: '103040',
        direccionFiscal: 'avenida abcd',
        codigoAnexo: '0000',
      },
      receptor: {
        tipoDocumento: 'ruc',
        numeroDocumento: '20601847834',
        razonSocial: 'osys company sac',
        direccion: 'direccion del cliente',
      },
      venta: {
        tipoCpe: 'factura',
        serie: 'F004',
        correlativo: '00000031',
        fechaEmision: '2020-02-19',
        moneda: 'PEN',
        tipoCambio: '1.000',
        correoCliente: 'mifact@outlook.com',
        codigoPuntoVenta: 'jmifact',
        codigoTipoOperacionSunat: '0101',
        placa: 'HNT384',
        items: [
          {
            codigo: 'BCF-RR01',
            descripcion: 'AUTO TOYOTA YARIS 2018',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '590',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
          {
            codigo: 'BCF-RR02',
            descripcion: 'DETALLE DEL PRODUCTO 2',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '590',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
        datosAdicionales: [
          { codigoTipo: '05', descripcion: 'texto para alguna observación' },
        ],
      },
      opciones: {
        enviarASunat: true,
        retornarXmlEnvio: true,
        retornarXmlCdr: false,
        retornarPdf: false,
        formatoImpresion: '001',
      },
    };

    expect(orquestador.construirCpe(input)).toEqual(expected);
  });

  // ── Caso 2: Boleta tradicional ────────────────────────────────────────────

  it('reproduce el golden boleta_tradicional desde input dominio', () => {
    const expected = proyectarCamposCpe(cargarGolden('boleta_tradicional.txt'));

    const input: OrquestarCpeInput = {
      token: 'gN8zNRBV+/FVxTLwdaZx0w==',
      emisor: {
        ruc: '20100100100',
        razonSocial: 'empresa demo',
        nombreComercial: 'demo',
        ubigeo: '103040',
        direccionFiscal: 'avenida abcd',
        codigoAnexo: '0000',
      },
      receptor: {
        tipoDocumento: 'dni',
        numeroDocumento: '40506089',
        razonSocial: 'MARIA GONZALES',
        direccion: 'direccion del cliente',
      },
      venta: {
        tipoCpe: 'boleta',
        serie: 'B004',
        correlativo: '00000031',
        fechaEmision: '2018-09-19',
        moneda: 'PEN',
        tipoCambio: '1.000',
        correoCliente: 'mifact@outlook.com',
        codigoPuntoVenta: 'jmifact',
        codigoTipoOperacionSunat: '0101',
        items: [
          {
            codigo: 'BCF-RR01',
            descripcion: 'AUTO TOYOTA YARIS 2018',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '590',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
          {
            codigo: 'BCF-RR02',
            descripcion: 'DETALLE DEL PRODUCTO 2',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '590',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
        datosAdicionales: [
          { codigoTipo: '05', descripcion: 'texto para alguna observación' },
        ],
      },
      opciones: {
        enviarASunat: true,
        retornarXmlEnvio: true,
        retornarXmlCdr: false,
        retornarPdf: true,
        formatoImpresion: '001',
      },
    };

    expect(orquestador.construirCpe(input)).toEqual(expected);
  });

  // ── Caso 3: Nota de crédito — devolución / anulación ─────────────────────

  it('reproduce el golden "nota de credito" (anulación) desde input dominio', () => {
    const expected = proyectarCamposCpe(cargarGolden('nota de credito.txt'));

    const input: OrquestarCpeInput = {
      token: 'gN8zNRBV+/FVxTLwdaZx0w==',
      emisor: {
        ruc: '20100100100',
        razonSocial: 'empresa demo',
        nombreComercial: 'demo',
        ubigeo: '103040',
        direccionFiscal: 'avenida abcd',
        codigoAnexo: '0000',
      },
      receptor: {
        tipoDocumento: 'ruc',
        numeroDocumento: '20601847834',
        razonSocial: 'osys company sac',
        direccion: 'direccion del cliente',
      },
      venta: {
        tipoCpe: 'nota_credito',
        serie: 'F004',
        correlativo: '00000031',
        fechaEmision: '2018-09-19',
        moneda: 'PEN',
        // Sin tipoCambio: el golden no lo incluye
        correoCliente: 'mifact@outlook.com',
        codigoPuntoVenta: 'jmifact',
        codigoTipoOperacionSunat: '0101',
        codigoTipoNc: '01', // 01 = anulación de la operación
        descripcionMotivo: 'EL CLIENTE NO DESEA EL PRODUCTO',
        items: [
          {
            codigo: 'BCF-RR01',
            descripcion: 'AUTO TOYOTA YARIS 2018',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '590',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
          {
            codigo: 'BCF-RR02',
            descripcion: 'DETALLE DEL PRODUCTO 2',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '590',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
        docsReferenciado: [
          {
            tipoDocumento: '01', // 01 = factura
            serie: 'F001',
            correlativo: '00000027',
            fechaEmision: '2017-02-01',
          },
        ],
      },
      opciones: {
        enviarASunat: true,
        retornarXmlEnvio: true,
        retornarXmlCdr: false,
        retornarPdf: false,
        formatoImpresion: '001',
      },
    };

    expect(orquestador.construirCpe(input)).toEqual(expected);
  });

  // ── Caso 4: Nota de crédito — corrección de descripción ──────────────────

  it('reproduce el golden nota_credito_correccion_descripcion desde input dominio', () => {
    const expected = proyectarCamposCpe(
      cargarGolden('nota_credito_correccion_descripcion.txt'),
    );

    const input: OrquestarCpeInput = {
      token: 'gN8zNRBV+/FVxTLwdaZx0w==',
      emisor: {
        ruc: '20100100100',
        razonSocial: 'empresa demo',
        nombreComercial: 'demo',
        ubigeo: '103040',
        direccionFiscal: 'avenida abcd',
        codigoAnexo: '0000',
      },
      receptor: {
        tipoDocumento: 'ruc',
        numeroDocumento: '20601847834',
        razonSocial: 'osys company sac',
        direccion: 'direccion del cliente',
      },
      venta: {
        tipoCpe: 'nota_credito',
        serie: 'FC01',
        correlativo: '00000031',
        fechaEmision: '2024-03-30',
        moneda: 'PEN',
        tipoCambio: '1.000',
        correoCliente: 'mifact@outlook.com',
        codigoPuntoVenta: 'jmifact',
        codigoTipoOperacionSunat: '0101',
        codigoTipoNc: '03', // 03 = corrección en la descripción
        descripcionMotivo: 'Corrección en la descripción',
        items: [
          {
            codigo: 'BCF-RR01',
            descripcion: 'AUTO TOYOTA YARIS 2018',
            unidadMedida: 'NIU',
            cantidad: 1,
            // Precio 0: NC de corrección no tiene montos (valores cero)
            precioUnitarioConIgv: '0',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
          {
            codigo: 'BCF-RR02',
            descripcion: 'DETALLE DEL PRODUCTO 2',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '0',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
        docsReferenciado: [
          {
            tipoDocumento: '01',
            serie: 'F001',
            correlativo: '00000027',
            fechaEmision: '2017-02-01',
          },
        ],
      },
      opciones: {
        enviarASunat: true,
        retornarXmlEnvio: true,
        retornarXmlCdr: false,
        retornarPdf: false,
        formatoImpresion: '001',
      },
    };

    expect(orquestador.construirCpe(input)).toEqual(expected);
  });

  // ── Caso 5: Nota de débito ────────────────────────────────────────────────

  it('reproduce el golden "nota de debito" desde input dominio', () => {
    const expected = proyectarCamposCpe(cargarGolden('nota de debito.txt'));

    const input: OrquestarCpeInput = {
      token: 'gN8zNRBV+/FVxTLwdaZx0w==',
      emisor: {
        ruc: '20100100100',
        razonSocial: 'empresa demo',
        nombreComercial: 'demo',
        ubigeo: '103040',
        direccionFiscal: 'avenida abcd',
        codigoAnexo: '0000',
      },
      receptor: {
        tipoDocumento: 'ruc',
        numeroDocumento: '20601847834',
        razonSocial: 'osys company sac',
        direccion: 'direccion del cliente',
      },
      venta: {
        tipoCpe: 'nota_debito',
        serie: 'FD04',
        correlativo: '00000031',
        fechaEmision: '2018-09-19',
        moneda: 'PEN',
        // Sin tipoCambio: el golden no lo incluye
        correoCliente: 'mifact@outlook.com',
        codigoPuntoVenta: 'jmifact',
        codigoTipoOperacionSunat: '0101',
        codigoTipoNd: '01', // 01 = intereses por mora / recargo
        descripcionMotivo: 'RECARGO POR DEUDA',
        items: [
          {
            codigo: 'BCF-RR01',
            descripcion: 'AUTO TOYOTA YARIS 2018',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '590',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
          {
            codigo: 'BCF-RR02',
            descripcion: 'DETALLE DEL PRODUCTO 2',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '590',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
        docsReferenciado: [
          {
            tipoDocumento: '01', // 01 = factura
            serie: 'F001',
            correlativo: '00000027',
            fechaEmision: '2017-02-01',
          },
        ],
      },
      opciones: {
        enviarASunat: true,
        retornarXmlEnvio: true,
        retornarXmlCdr: false,
        retornarPdf: false,
        formatoImpresion: '001',
      },
    };

    expect(orquestador.construirCpe(input)).toEqual(expected);
  });

  // ── Caso 6: Factura con descuento global ──────────────────────────────────

  it('reproduce el golden factura_con_DSCTO_GLOBAL desde input dominio', () => {
    const expected = proyectarCamposCpe(cargarGolden('factura_con_DSCTO_GLOBAL.txt'));

    const input: OrquestarCpeInput = {
      token: 'gN8zNRBV+/FVxTLwdaZx0w==',
      emisor: {
        ruc: '20100100100',
        razonSocial: 'empresa demo',
        nombreComercial: 'demo',
        ubigeo: '103040',
        direccionFiscal: 'avenida abcd',
        codigoAnexo: '0000',
      },
      receptor: {
        tipoDocumento: 'ruc',
        numeroDocumento: '20601847834',
        razonSocial: 'osys company sac',
        direccion: 'direccion del cliente',
      },
      venta: {
        tipoCpe: 'factura',
        serie: 'F004',
        correlativo: '00000037',
        fechaEmision: '2021-06-09',
        moneda: 'PEN',
        tipoCambio: '1.000',
        correoCliente: 'mifact@outlook.com',
        codigoPuntoVenta: 'jmifact',
        codigoTipoOperacionSunat: '0101',
        // descuento global de 10.00 PEN sobre la base gravada
        descuentoGlobal: '10.00',
        codigoTipoDescuento: '02',
        items: [
          {
            codigo: 'BCF-RR01',
            descripcion: 'AUTO TOYOTA YARIS 2018',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: '82.60',
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
      },
      opciones: {
        enviarASunat: true,
        retornarXmlEnvio: true,
        retornarXmlCdr: false,
        retornarPdf: false,
        formatoImpresion: '001',
      },
    };

    expect(orquestador.construirCpe(input)).toEqual(expected);
  });
});
