/**
 * Tests unitarios de MifactService.
 *
 * HttpService se mockea con jest.fn() que retorna un Observable de la respuesta
 * canned. Sin llamadas HTTP reales, sin axios-mock-adapter, sin nock.
 */
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MifactService } from './mifact.service';
import type {
  MifactConfig,
  AnularCpeInput,
  ConsultarEstadoInput,
  ObtenerCpeInput,
  EnviarCorreoInput,
  MifactRespuestaCruda,
} from './types';
import type { MifactCpePayload } from '../cpe-builder/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Respuesta canned válida que devuelve Mifact para cualquier operación. */
const respuestaCanned: MifactRespuestaCruda = {
  errors: '',
  estado_documento: '102',
  tipo_cpe: '01',
  serie_cpe: 'F004',
  correlativo_cpe: '00000031',
  url: 'https://demo.mifact.net.pe/documentos/F004-31.pdf',
  sunat_description: 'La Factura numero F004-31, ha sido aceptada',
  sunat_note: '',
  sunat_responsecode: '0',
  pdf_bytes: 'base64-pdf==',
  xml_enviado: '<Invoice/>',
  cdr_sunat: '<ApplicationResponse/>',
  cadena_para_codigo_qr: '20100100100|01|F004|00000031|...',
  codigo_hash: 'ABCDEF1234567890',
  ticket_sunat: '',
};

function crearAxiosResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
}

function crearHttpServiceMock(data: unknown = respuestaCanned) {
  return {
    post: jest.fn().mockReturnValue(of(crearAxiosResponse(data))),
  };
}

const config: MifactConfig = {
  baseUrl: 'https://demo.mifact.net.pe',
  token: 'gN8zNRBV+/FVxTLwdaZx0w==',
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('MifactService', () => {
  // ── enviarCpe ──────────────────────────────────────────────────────────────

  describe('enviarCpe', () => {
    it('POST a SendInvoice con TOKEN y payload del orquestador; retorna respuesta parseada', async () => {
      const httpService = crearHttpServiceMock();
      const service = new MifactService(httpService as never);

      const payload = {
        TOKEN: 'ignorado-se-sobreescribe',
        NUM_NIF_EMIS: '20100100100',
        COD_TIP_CPE: '01',
        NUM_SERIE_CPE: 'F004',
        NUM_CORRE_CPE: '00000031',
      } as unknown as MifactCpePayload;

      const resultado = await service.enviarCpe(config, payload);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://demo.mifact.net.pe/api/invoiceService.svc/SendInvoice',
        expect.objectContaining({
          TOKEN: config.token,
          NUM_NIF_EMIS: '20100100100',
        }),
      );
      expect(resultado.estadoSunat).toBe('aceptado');
      expect(resultado.estadoDocumentoCodigo).toBe('102');
      expect(resultado.serieCpe).toBe('F004');
    });
  });

  // ── anularCpe ──────────────────────────────────────────────────────────────

  describe('anularCpe', () => {
    it('POST a LowInvoice con TOKEN + campos de anulación; retorna respuesta parseada', async () => {
      const httpService = crearHttpServiceMock();
      const service = new MifactService(httpService as never);

      const input: AnularCpeInput = {
        NUM_NIF_EMIS: '20100100100',
        FEC_EMIS: '2018-02-21',
        COD_TIP_CPE: '01',
        NUM_SERIE_CPE: 'F004',
        NUM_CORRE_CPE: '00000027',
        TXT_DESC_MTVO: 'ANULACION POR ERROR',
        COD_PTO_VENTA: 'usuarioABCD',
      };

      const resultado = await service.anularCpe(config, input);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://demo.mifact.net.pe/api/invoiceService.svc/LowInvoice',
        expect.objectContaining({
          TOKEN: config.token,
          NUM_NIF_EMIS: '20100100100',
          TXT_DESC_MTVO: 'ANULACION POR ERROR',
          COD_PTO_VENTA: 'usuarioABCD',
        }),
      );
      expect(resultado.estadoSunat).toBe('aceptado');
    });
  });

  // ── consultarEstado ────────────────────────────────────────────────────────

  describe('consultarEstado', () => {
    it('POST a GetEstatusInvoice con TOKEN + identificadores; retorna estado mapeado', async () => {
      const httpService = crearHttpServiceMock({
        ...respuestaCanned,
        estado_documento: '101',
      });
      const service = new MifactService(httpService as never);

      const input: ConsultarEstadoInput = {
        NUM_NIF_EMIS: '20100100100',
        COD_TIP_CPE: '01',
        NUM_SERIE_CPE: 'F004',
        NUM_CORRE_CPE: '00000027',
        FEC_EMIS: '2021-06-19',
      };

      const resultado = await service.consultarEstado(config, input);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://demo.mifact.net.pe/api/invoiceService.svc/GetEstatusInvoice',
        expect.objectContaining({
          TOKEN: config.token,
          NUM_NIF_EMIS: '20100100100',
          FEC_EMIS: '2021-06-19',
        }),
      );
      expect(resultado.estadoSunat).toBe('en_proceso');
      expect(resultado.estadoDocumentoCodigo).toBe('101');
    });
  });

  // ── obtenerCpe ─────────────────────────────────────────────────────────────

  describe('obtenerCpe', () => {
    it('POST a GetInvoice con TOKEN + opciones retorno; retorna bytes base64 y estado', async () => {
      const httpService = crearHttpServiceMock();
      const service = new MifactService(httpService as never);

      const input: ObtenerCpeInput = {
        NUM_NIF_EMIS: '20100100100',
        COD_TIP_CPE: '01',
        NUM_SERIE_CPE: 'F004',
        NUM_CORRE_CPE: '00000027',
        FEC_EMIS: '2021-06-19',
        RETORNA_XML_ENVIO: 'false',
        RETORNA_XML_CDR: 'false',
        RETORNA_PDF: 'true',
        COD_FORM_IMPR: '001',
      };

      const resultado = await service.obtenerCpe(config, input);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://demo.mifact.net.pe/api/invoiceService.svc/GetInvoice',
        expect.objectContaining({
          TOKEN: config.token,
          RETORNA_PDF: 'true',
          COD_FORM_IMPR: '001',
        }),
      );
      expect(resultado.pdfBytes).toBe('base64-pdf==');
    });
  });

  // ── enviarCorreo ───────────────────────────────────────────────────────────

  describe('enviarCorreo', () => {
    it('POST a SendMailInvoice con TOKEN + correo destino; retorna respuesta parseada', async () => {
      const httpService = crearHttpServiceMock();
      const service = new MifactService(httpService as never);

      const input: EnviarCorreoInput = {
        NUM_NIF_EMIS: '20100100100',
        COD_TIP_CPE: '01',
        NUM_SERIE_CPE: 'F004',
        NUM_CORRE_CPE: '00000027',
        TXT_CORREO_ENVIO: 'mifact@outlook.com',
        FEC_EMIS: '2021-06-19',
      };

      const resultado = await service.enviarCorreo(config, input);

      expect(httpService.post).toHaveBeenCalledWith(
        'https://demo.mifact.net.pe/api/invoiceService.svc/SendMailInvoice',
        expect.objectContaining({
          TOKEN: config.token,
          TXT_CORREO_ENVIO: 'mifact@outlook.com',
        }),
      );
      expect(resultado.estadoSunat).toBe('aceptado');
    });
  });

  // ── Error: HTTP 500 ────────────────────────────────────────────────────────

  describe('manejo de errores HTTP', () => {
    it('HTTP 500 de Mifact → lanza ErrorAplicacion con código 500 y mensaje descriptivo', async () => {
      const httpService = {
        post: jest.fn().mockReturnValue(
          throwError(() => ({
            response: {
              status: 500,
              data: { message: 'Internal Server Error' },
            },
          })),
        ),
      };
      const service = new MifactService(httpService as never);

      const input: ConsultarEstadoInput = {
        NUM_NIF_EMIS: '20100100100',
        COD_TIP_CPE: '01',
        NUM_SERIE_CPE: 'F004',
        NUM_CORRE_CPE: '00000027',
        FEC_EMIS: '2021-06-19',
      };

      await expect(service.consultarEstado(config, input)).rejects.toMatchObject(
        {
          codigo: 500,
          message: expect.stringContaining('Mifact respondió con error HTTP 500'),
        },
      );
    });
  });

  // ── Error: Zod — respuesta inesperada ─────────────────────────────────────

  describe('validación Zod de respuesta', () => {
    it('respuesta Mifact con campo faltante → lanza ErrorAplicacion con código 502', async () => {
      // Omitimos 'ticket_sunat' para forzar fallo Zod
      const respuestaIncompleta = { ...respuestaCanned };
      delete (respuestaIncompleta as Partial<MifactRespuestaCruda>).ticket_sunat;

      const httpService = crearHttpServiceMock(respuestaIncompleta);
      const service = new MifactService(httpService as never);

      const input: ConsultarEstadoInput = {
        NUM_NIF_EMIS: '20100100100',
        COD_TIP_CPE: '01',
        NUM_SERIE_CPE: 'F004',
        NUM_CORRE_CPE: '00000027',
        FEC_EMIS: '2021-06-19',
      };

      await expect(service.consultarEstado(config, input)).rejects.toMatchObject(
        {
          codigo: 502,
          message: expect.stringContaining('schema esperado'),
        },
      );
    });
  });
});
