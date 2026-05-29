import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import {
  ErrorAplicacion,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';

/**
 * Wrapper de la API pública peruana **json.pe** para consulta de DNI / RUC.
 *
 * Memoria del usuario:
 *  - Proveedor ÚNICO de consultas (no apisperu/scrapers). Si falla, degradar
 *    con error claro; NO armar cascada con otros providers.
 *  - Si devuelve "no encontrado", NO insertar en BD; mostrar 404 al usuario.
 *
 * Envs:
 *  - `JSONPE_API_TOKEN` (obligatoria) — Bearer
 *  - `JSONPE_API_URL`  (opcional)    — default `https://api.json.pe`
 */

class ErrorServicioExterno extends ErrorAplicacion {
  constructor(mensaje: string) {
    super(503, mensaje);
  }
}

// Forma real verificada (2026-05) de `data` en json.pe:
// RUC:  { ruc, nombre_o_razon_social, estado, condicion, direccion,
//         direccion_completa, departamento, provincia, distrito,
//         ubigeo_sunat, ubigeo: string[3] }
// DNI:  { numero, nombre_completo, nombres, apellido_paterno, apellido_materno,
//         direccion, direccion_completa, ubigeo_sunat }
const RucPayload = z.object({
  ruc: z.string().optional(),
  // json.pe envía `nombre_o_razon_social`. Se aceptan variantes por compat.
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
}).passthrough();

const DniPayload = z.object({
  numero: z.string().optional(),
  dni: z.string().optional(),
  nombre_completo: z.string().optional(),
  nombreCompleto: z.string().optional(),
  nombres: z.string().optional(),
  apellido_paterno: z.string().optional(),
  apellidoPaterno: z.string().optional(),
  apellido_materno: z.string().optional(),
  apellidoMaterno: z.string().optional(),
}).passthrough();

export interface DatosRucNorm {
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  estado: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  ubigeo: string | null;
}

export interface DatosDniNorm {
  dni: string;
  nombres: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  nombreCompleto: string;
}

@Injectable()
export class JsonPeService {
  private readonly logger = new Logger(JsonPeService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.get<string>('JSONPE_API_URL') ?? 'https://api.json.pe';
  }
  private get token(): string {
    const t = this.config.get<string>('JSONPE_API_TOKEN');
    if (!t) {
      throw new ErrorServicioExterno(
        'Servicio de consulta de RUC/DNI no configurado (falta JSONPE_API_TOKEN).',
      );
    }
    return t;
  }

  async consultarRuc(ruc: string): Promise<DatosRucNorm> {
    const limpio = (ruc ?? '').replace(/\D+/g, '');
    if (!/^\d{11}$/.test(limpio)) {
      throw new ErrorValidacion('El RUC debe tener 11 dígitos numéricos');
    }
    const data = await this.llamar('/api/ruc', { ruc: limpio, numero: limpio });
    const parsed = RucPayload.safeParse(data);
    if (!parsed.success) {
      this.logger.warn({ ruc: limpio, data }, 'Respuesta json.pe RUC no parseable');
      throw new ErrorServicioExterno('Respuesta inesperada del servicio de RUC');
    }
    const r = parsed.data;
    const razonSocial = (
      r.nombre_o_razon_social ?? r.nombreORazonSocial ?? r.razonSocial ?? ''
    ).trim();
    if (!razonSocial) {
      throw new ErrorNoEncontrado(`No se encontró el RUC ${limpio} en SUNAT`);
    }
    return {
      ruc: limpio,
      razonSocial,
      // json.pe no devuelve nombre comercial separado (siempre va dentro de razón social).
      nombreComercial: null,
      estado: r.estado ?? null,
      direccion: r.direccion_completa ?? r.direccionCompleta ?? r.direccion ?? null,
      departamento: r.departamento ?? null,
      provincia: r.provincia ?? null,
      distrito: r.distrito ?? null,
      ubigeo: r.ubigeo_sunat ?? r.ubigeoSunat ?? null,
    };
  }

  async consultarDni(dni: string): Promise<DatosDniNorm> {
    const limpio = (dni ?? '').replace(/\D+/g, '');
    if (!/^\d{8}$/.test(limpio)) {
      throw new ErrorValidacion('El DNI debe tener 8 dígitos numéricos');
    }
    const data = await this.llamar('/api/dni', { dni: limpio, numero: limpio });
    const parsed = DniPayload.safeParse(data);
    if (!parsed.success) {
      this.logger.warn({ dni: limpio, data }, 'Respuesta json.pe DNI no parseable');
      throw new ErrorServicioExterno('Respuesta inesperada del servicio de DNI');
    }
    const r = parsed.data;
    const ap = (r.apellido_paterno ?? r.apellidoPaterno ?? '').trim();
    const am = (r.apellido_materno ?? r.apellidoMaterno ?? '').trim();
    const nom = (r.nombres ?? '').trim();
    const completo = (r.nombre_completo ?? r.nombreCompleto ?? `${nom} ${ap} ${am}`).trim().replace(/\s+/g, ' ');
    if (!completo) {
      throw new ErrorNoEncontrado(`No se encontró el DNI ${limpio} en RENIEC`);
    }
    return {
      dni: limpio,
      nombres: nom || null,
      apellidoPaterno: ap || null,
      apellidoMaterno: am || null,
      nombreCompleto: completo,
    };
  }

  private async llamar(path: string, body: Record<string, string>): Promise<unknown> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    try {
      const resp = await firstValueFrom(
        this.http.post(url, body, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 8000,
          validateStatus: () => true,
        }),
      );
      const status = resp.status;
      const data = resp.data;
      if (status === 404) {
        throw new ErrorNoEncontrado('Documento no encontrado en la fuente oficial');
      }
      if (status === 401 || status === 403) {
        throw new ErrorServicioExterno('Token de json.pe rechazado por el servidor');
      }
      if (status === 429) {
        throw new ErrorServicioExterno('Límite de consultas de json.pe alcanzado');
      }
      if (status >= 400) {
        const msg =
          typeof data === 'string'
            ? data
            : (data as { message?: string; error?: string })?.message
              ?? (data as { error?: string })?.error
              ?? `json.pe devolvió HTTP ${status}`;
        throw new ErrorServicioExterno(String(msg));
      }
      // Algunas APIs envuelven en `{ data: ... }` o `{ datos: ... }`
      if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        if (d.data && typeof d.data === 'object') return d.data;
        if (d.datos && typeof d.datos === 'object') return d.datos;
      }
      return data;
    } catch (err) {
      if (err instanceof ErrorAplicacion) throw err;
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Error desconocido';
      this.logger.error({ err: msg, url }, 'Falla al consultar json.pe');
      throw new ErrorServicioExterno(`No se pudo consultar json.pe: ${msg}`);
    }
  }
}
