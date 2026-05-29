import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import { ProveedorConsultaDoc } from '../proveedor-consulta-doc.puerto';
import { ResultadoConsulta, DatosRuc, DatosDni } from '../tipos';

/**
 * ADAPTADOR para la API pública peruana **json.pe** (RENIEC/SUNAT).
 *
 * Es la ÚNICA pieza que conoce las URLs, el header Bearer y los nombres crudos
 * de los campos de json.pe. Todo lo específico del proveedor vive acá. Para
 * cambiar de proveedor: crear otro adaptador que implemente ProveedorConsultaDoc
 * y registrarlo en el factory.
 *
 * NUNCA lanza: siempre devuelve un `ResultadoConsulta`. Quien traduce a HTTP es
 * el controller. Memoria del usuario: proveedor ÚNICO (no cascada con scrapers);
 * si "no encontrado", NO insertar en BD. Ver `docs/integracion-jsonpe.md`.
 *
 * Envs:
 *  - `JSONPE_API_TOKEN` (obligatoria) — Bearer
 *  - `JSONPE_API_URL`  (opcional)    — default `https://api.json.pe`
 */

const MSG_SIN_TOKEN =
  'Servicio de consulta de RUC/DNI no configurado (falta JSONPE_API_TOKEN).';

// Forma real verificada (2026-05) de `data` en json.pe. Se aceptan variantes
// camelCase por compatibilidad defensiva.
const RucPayload = z
  .object({
    ruc: z.string().optional(),
    nombre_o_razon_social: z.string().optional(),
    nombreORazonSocial: z.string().optional(),
    razonSocial: z.string().optional(),
    estado: z.string().optional(),
    condicion: z.string().optional(),
    direccion: z.string().optional(),
    direccion_completa: z.string().optional(),
    direccionCompleta: z.string().optional(),
    departamento: z.string().optional(),
    provincia: z.string().optional(),
    distrito: z.string().optional(),
    ubigeo_sunat: z.string().optional(),
    ubigeoSunat: z.string().optional(),
  })
  .passthrough();

const DniPayload = z
  .object({
    numero: z.string().optional(),
    dni: z.string().optional(),
    nombre_completo: z.string().optional(),
    nombreCompleto: z.string().optional(),
    nombres: z.string().optional(),
    apellido_paterno: z.string().optional(),
    apellidoPaterno: z.string().optional(),
    apellido_materno: z.string().optional(),
    apellidoMaterno: z.string().optional(),
  })
  .passthrough();

export class JsonPeAdapter implements ProveedorConsultaDoc {
  readonly nombre = 'json.pe';
  private readonly logger = new Logger(JsonPeAdapter.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  get disponible(): boolean {
    return !!this.config.get<string>('JSONPE_API_TOKEN');
  }

  private get baseUrl(): string {
    return this.config.get<string>('JSONPE_API_URL') ?? 'https://api.json.pe';
  }

  async consultarRuc(ruc: string): Promise<ResultadoConsulta<DatosRuc>> {
    if (!this.disponible) {
      return { tipo: 'fuera_de_servicio', mensaje: MSG_SIN_TOKEN };
    }
    const limpio = (ruc ?? '').replace(/\D+/g, '');
    let resp: { status: number; data: unknown };
    try {
      resp = await this.pedir('/api/ruc', { ruc: limpio, numero: limpio });
    } catch (err) {
      return this.errorRed(err, '/api/ruc');
    }
    const noOk = this.clasificarHttp(resp.status);
    if (noOk) return noOk;

    const parsed = RucPayload.safeParse(this.desenvolver(resp.data));
    if (!parsed.success) {
      this.logger.warn({ ruc: limpio }, 'Respuesta json.pe RUC no parseable');
      return {
        tipo: 'error_tecnico',
        mensaje: 'Respuesta inesperada del servicio de RUC',
      };
    }
    const r = parsed.data;
    const razonSocial = (
      r.nombre_o_razon_social ??
      r.nombreORazonSocial ??
      r.razonSocial ??
      ''
    ).trim();
    if (!razonSocial) {
      return {
        tipo: 'sin_datos',
        mensaje: `No se encontró el RUC ${limpio} en SUNAT`,
      };
    }
    return {
      tipo: 'datos',
      datos: {
        ruc: limpio,
        razonSocial,
        // json.pe no separa nombre comercial (va dentro de la razón social).
        nombreComercial: null,
        estado: r.estado ?? null,
        direccion:
          r.direccion_completa ?? r.direccionCompleta ?? r.direccion ?? null,
        departamento: r.departamento ?? null,
        provincia: r.provincia ?? null,
        distrito: r.distrito ?? null,
        ubigeo: r.ubigeo_sunat ?? r.ubigeoSunat ?? null,
      },
    };
  }

  async consultarDni(dni: string): Promise<ResultadoConsulta<DatosDni>> {
    if (!this.disponible) {
      return { tipo: 'fuera_de_servicio', mensaje: MSG_SIN_TOKEN };
    }
    const limpio = (dni ?? '').replace(/\D+/g, '');
    let resp: { status: number; data: unknown };
    try {
      resp = await this.pedir('/api/dni', { dni: limpio, numero: limpio });
    } catch (err) {
      return this.errorRed(err, '/api/dni');
    }
    const noOk = this.clasificarHttp(resp.status);
    if (noOk) return noOk;

    const parsed = DniPayload.safeParse(this.desenvolver(resp.data));
    if (!parsed.success) {
      this.logger.warn({ dni: limpio }, 'Respuesta json.pe DNI no parseable');
      return {
        tipo: 'error_tecnico',
        mensaje: 'Respuesta inesperada del servicio de DNI',
      };
    }
    const r = parsed.data;
    const ap = (r.apellido_paterno ?? r.apellidoPaterno ?? '').trim();
    const am = (r.apellido_materno ?? r.apellidoMaterno ?? '').trim();
    const nom = (r.nombres ?? '').trim();
    const completo = (
      r.nombre_completo ??
      r.nombreCompleto ??
      `${nom} ${ap} ${am}`
    )
      .trim()
      .replace(/\s+/g, ' ');
    if (!completo) {
      return {
        tipo: 'sin_datos',
        mensaje: `No se encontró el DNI ${limpio} en RENIEC`,
      };
    }
    return {
      tipo: 'datos',
      datos: {
        dni: limpio,
        nombres: nom || null,
        apellidoPaterno: ap || null,
        apellidoMaterno: am || null,
        nombreCompleto: completo,
      },
    };
  }

  /** POST crudo. No lanza por status (validateStatus true); sí lanza por red. */
  private async pedir(
    path: string,
    body: Record<string, string>,
  ): Promise<{ status: number; data: unknown }> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    const token = this.config.get<string>('JSONPE_API_TOKEN');
    const resp = await firstValueFrom(
      this.http.post(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 8000,
        validateStatus: () => true,
      }),
    );
    return { status: resp.status, data: resp.data };
  }

  /** Mapea un status != 2xx a sin_datos / error_tecnico. Null si es 2xx. */
  private clasificarHttp(
    status: number,
  ): { tipo: 'sin_datos' | 'error_tecnico'; mensaje: string } | null {
    if (status === 404) {
      return {
        tipo: 'sin_datos',
        mensaje: 'Documento no encontrado en la fuente oficial',
      };
    }
    if (status === 401 || status === 403) {
      return {
        tipo: 'error_tecnico',
        mensaje: 'Token de json.pe rechazado por el servidor',
      };
    }
    if (status === 429) {
      return {
        tipo: 'error_tecnico',
        mensaje: 'Límite de consultas de json.pe alcanzado',
      };
    }
    if (status >= 400) {
      return {
        tipo: 'error_tecnico',
        mensaje: `json.pe devolvió HTTP ${status}`,
      };
    }
    return null;
  }

  /** Algunas APIs envuelven la carga en `{ data }` o `{ datos }`. */
  private desenvolver(data: unknown): unknown {
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (d.data && typeof d.data === 'object') return d.data;
      if (d.datos && typeof d.datos === 'object') return d.datos;
    }
    return data;
  }

  private errorRed(
    err: unknown,
    path: string,
  ): { tipo: 'error_tecnico'; mensaje: string } {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Error desconocido';
    this.logger.error({ err: msg, path }, 'Falla al consultar json.pe');
    return {
      tipo: 'error_tecnico',
      mensaje: `No se pudo consultar json.pe: ${msg}`,
    };
  }
}
