/**
 * MifactService — cliente HTTP contra el OSE Mifact para emisión de CPE SUNAT.
 *
 * Endpoints (base demo: https://demo.mifact.net.pe):
 *   POST /api/invoiceService.svc/SendInvoice       — enviar CPE
 *   POST /api/invoiceService.svc/LowInvoice        — anular CPE
 *   POST /api/invoiceService.svc/GetEstatusInvoice — consultar estado
 *   POST /api/invoiceService.svc/GetInvoice        — obtener PDF/XML/CDR
 *   POST /api/invoiceService.svc/SendMailInvoice   — enviar correo
 *
 * Refs: URLs_PRUEBAS.txt, ANULACION_DOCUMENTO.txt,
 *       "CONSULTAR ESTADO_DOCUMENTO.txt", CONSULTAR_PDF_XML_CDR.txt,
 *       ENVIAR_CORREO_A_DEMANDA.txt, RespuestaInvoice.cs
 */
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ZodError } from 'zod';
import { ErrorAplicacion } from 'src/core/errors/errores';
import { CODIGO_A_ESTADO_SUNAT } from 'src/core/sunat/codigos';
import {
  MifactConfig,
  EnviarCpeInput,
  AnularCpeInput,
  ConsultarEstadoInput,
  ObtenerCpeInput,
  EnviarCorreoInput,
  MifactRespuesta,
  MifactRespuestaCruda,
  MifactRespuestaCrudaSchema,
} from './types';

@Injectable()
export class MifactService {
  constructor(private readonly httpService: HttpService) {}

  // ─── Métodos públicos ──────────────────────────────────────────────────────

  /**
   * Envía un CPE a Mifact (SendInvoice).
   * El payload es el JSON producido por CpeOrquestadorService + TOKEN ya incluido.
   */
  async enviarCpe(
    config: MifactConfig,
    payload: EnviarCpeInput,
  ): Promise<MifactRespuesta> {
    const url = `${config.baseUrl}/api/invoiceService.svc/SendInvoice`;
    const body = { ...payload, TOKEN: config.token };
    const cruda = await this.ejecutarPost<MifactRespuestaCruda>(url, body);
    return this.parsearRespuesta(cruda);
  }

  /**
   * Anula un CPE (LowInvoice).
   */
  async anularCpe(
    config: MifactConfig,
    input: AnularCpeInput,
  ): Promise<MifactRespuesta> {
    const url = `${config.baseUrl}/api/invoiceService.svc/LowInvoice`;
    const body = { TOKEN: config.token, ...input };
    const cruda = await this.ejecutarPost<MifactRespuestaCruda>(url, body);
    return this.parsearRespuesta(cruda);
  }

  /**
   * Consulta el estado de un CPE en Mifact y SUNAT (GetEstatusInvoice).
   */
  async consultarEstado(
    config: MifactConfig,
    input: ConsultarEstadoInput,
  ): Promise<MifactRespuesta> {
    const url = `${config.baseUrl}/api/invoiceService.svc/GetEstatusInvoice`;
    const body = { TOKEN: config.token, ...input };
    const cruda = await this.ejecutarPost<MifactRespuestaCruda>(url, body);
    return this.parsearRespuesta(cruda);
  }

  /**
   * Obtiene el PDF, XML enviado y/o CDR de un CPE (GetInvoice).
   */
  async obtenerCpe(
    config: MifactConfig,
    input: ObtenerCpeInput,
  ): Promise<MifactRespuesta> {
    const url = `${config.baseUrl}/api/invoiceService.svc/GetInvoice`;
    const body = { TOKEN: config.token, ...input };
    const cruda = await this.ejecutarPost<MifactRespuestaCruda>(url, body);
    return this.parsearRespuesta(cruda);
  }

  /**
   * Envía el correo electrónico con el CPE adjunto (SendMailInvoice).
   */
  async enviarCorreo(
    config: MifactConfig,
    input: EnviarCorreoInput,
  ): Promise<MifactRespuesta> {
    const url = `${config.baseUrl}/api/invoiceService.svc/SendMailInvoice`;
    const body = { TOKEN: config.token, ...input };
    const cruda = await this.ejecutarPost<MifactRespuestaCruda>(url, body);
    return this.parsearRespuesta(cruda);
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  /**
   * Ejecuta un POST HTTP contra Mifact y devuelve el body parseado.
   * Lanza ErrorAplicacion en errores HTTP (4xx/5xx) o de red.
   */
  private async ejecutarPost<T>(url: string, body: unknown): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(url, body),
      );
      return response.data;
    } catch (err: unknown) {
      const error = err as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };

      if (error.response) {
        const status = error.response.status ?? 0;
        const detalle = JSON.stringify(error.response.data ?? '');
        throw new ErrorAplicacion(
          status,
          `Mifact respondió con error HTTP ${status}: ${detalle}`,
        );
      }

      throw new ErrorAplicacion(
        502,
        `Error de red al contactar Mifact: ${error.message ?? 'sin detalle'}`,
      );
    }
  }

  /**
   * Valida la respuesta cruda con Zod y la mapea a MifactRespuesta.
   * Lanza ErrorAplicacion si la validación Zod falla (respuesta inesperada).
   */
  private parsearRespuesta(raw: unknown): MifactRespuesta {
    let cruda: MifactRespuestaCruda;

    try {
      cruda = MifactRespuestaCrudaSchema.parse(raw);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        throw new ErrorAplicacion(
          502,
          `Respuesta de Mifact no cumple el schema esperado: ${err.message}`,
        );
      }
      throw err;
    }

    const estadoSunat = CODIGO_A_ESTADO_SUNAT[cruda.estado_documento] ?? null;

    return {
      errors: cruda.errors,
      estadoSunat,
      estadoDocumentoCodigo: cruda.estado_documento,
      tipoCpe: cruda.tipo_cpe,
      serieCpe: cruda.serie_cpe,
      correlativoCpe: cruda.correlativo_cpe,
      url: cruda.url,
      sunatDescription: cruda.sunat_description,
      sunatNote: cruda.sunat_note,
      sunatResponsecode: cruda.sunat_responsecode,
      pdfBytes: cruda.pdf_bytes,
      xmlEnviado: cruda.xml_enviado,
      cdrSunat: cruda.cdr_sunat,
      cadenaParaCodigoQr: cruda.cadena_para_codigo_qr,
      codigoHash: cruda.codigo_hash,
      ticketSunat: cruda.ticket_sunat,
    };
  }
}
