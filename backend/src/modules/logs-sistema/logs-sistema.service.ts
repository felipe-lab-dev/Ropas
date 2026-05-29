import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'os';
import { Prisma } from '@prisma/client';
import { PrismaPublicService } from '../../core/prisma/prisma-public.service';

/**
 * Logs de Sistema — captura y consulta de errores del backend.
 *
 * Convive con Pino y Application Insights. Guarda los errores en Postgres
 * para que TI los vea desde la UI del propio ERP, los marque como resueltos,
 * y los correlacione con datos del negocio (usuario, sucursal, request body).
 *
 * Persistencia fire-and-forget: si falla insertar el log, NO debe impedir
 * que la respuesta de error llegue al cliente.
 *
 * Importado del patrón de DIH ERP (`logSistema.service.ts`), portado a Prisma.
 */

export type SeveridadLog = 'warn' | 'error' | 'critical';

export interface RegistroError {
  tenantCodigo?: string | null;
  mensaje: string;
  tipo?: string | null;
  stack?: string | null;
  ruta?: string | null;
  metodo?: string | null;
  statusCode?: number | null;
  usuarioId?: string | null;
  usuarioNombre?: string | null;
  sucursalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestBody?: unknown;
  requestQuery?: unknown;
  replica?: string | null;
  severidad?: SeveridadLog;
}

export interface ConsultaLogs {
  pagina?: number | string;
  limite?: number | string;
  buscar?: string;
  statusCode?: number | string;
  metodo?: string;
  severidad?: SeveridadLog;
  usuarioId?: string;
  sucursalId?: string;
  replica?: string;
  soloNoResueltos?: boolean | string;
  desde?: string;
  hasta?: string;
}

function detectarReplica(): string {
  const env = process.env.HOSTNAME?.trim();
  if (env) return env;
  try {
    const os = hostname()?.trim();
    if (os) return os;
  } catch {
    /* hostname() puede fallar en sandboxed envs */
  }
  return 'local';
}

const REPLICA = detectarReplica();

// Circuit breaker para evitar feedback loop si la propia DB se cae.
// Igual al de DIH ERP: si el INSERT del log falla por timeout de conexion,
// abrimos cooldown de 60s para que no comamos pool registrando que el pool
// no responde.
const CONNECT_ERR_REGEX =
  /(timeout exceeded when trying to connect|Connection terminated|ECONNRESET|ENOTFOUND|getaddrinfo|connection timeout)/i;
const COOLDOWN_MS = 60_000;
let dbLogCooldownUntil = 0;

function esErrorConexionPg(msgOrErr: unknown): boolean {
  if (!msgOrErr) return false;
  const txt =
    typeof msgOrErr === 'string'
      ? msgOrErr
      : (msgOrErr as { message?: string })?.message || String(msgOrErr);
  return CONNECT_ERR_REGEX.test(txt);
}

function truncar(valor: string | undefined | null, max: number): string | null {
  if (!valor) return null;
  if (valor.length <= max) return valor;
  return valor.slice(0, max) + `…[truncado ${valor.length - max} chars]`;
}

const CLAVES_SENSIBLES = new Set([
  'password',
  'contrasena',
  'contraseña',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'jwt',
  'secret',
  'authorization',
  'apiKey',
]);

function sanearBody(body: unknown): Prisma.JsonValue | null {
  if (body == null || typeof body !== 'object') return null;
  const limpiar = (obj: unknown, profundidad = 0): Prisma.JsonValue => {
    if (profundidad > 3) return '[…]';
    if (obj == null) return null;
    if (typeof obj === 'string') return obj.length > 1000 ? truncar(obj, 1000) : obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (Buffer.isBuffer(obj)) return `[Buffer ${obj.length} bytes]`;
    if (Array.isArray(obj))
      return obj.slice(0, 50).map(v => limpiar(v, profundidad + 1));
    if (typeof obj === 'object') {
      const out: Record<string, Prisma.JsonValue> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (CLAVES_SENSIBLES.has(k)) {
          out[k] = '[REDACTED]';
          continue;
        }
        out[k] = limpiar(v, profundidad + 1);
      }
      return out;
    }
    return String(obj);
  };
  try {
    return limpiar(body);
  } catch {
    return null;
  }
}

@Injectable()
export class LogsSistemaService {
  private readonly logger = new Logger(LogsSistemaService.name);

  constructor(private readonly prisma: PrismaPublicService) {}

  /**
   * Persiste un error en la tabla `errores_sistema`. Fire-and-forget:
   * captura cualquier excepción internamente y nunca propaga al caller.
   */
  async registrar(data: RegistroError): Promise<void> {
    // Compuerta 0: solo en produccion. En dev cada error de un dev mientras
    // codea inflaria la tabla; igual Pino sigue capturando todo.
    if (process.env.NODE_ENV !== 'production') return;

    // Compuerta 1: el propio error es de conexion PG → no sentido insertar
    // en PG para registrar que PG no responde.
    if (
      esErrorConexionPg(data.mensaje) ||
      esErrorConexionPg(data.tipo) ||
      esErrorConexionPg(data.stack)
    ) {
      this.logger.warn(
        `[LogSistema] Skip INSERT — error de conexion PG (evita feedback loop) ruta=${data.ruta}`,
      );
      return;
    }

    // Compuerta 2: circuit breaker abierto.
    if (Date.now() < dbLogCooldownUntil) {
      this.logger.warn(
        `[LogSistema] Skip INSERT — circuit breaker activo (cooldown ${
          dbLogCooldownUntil - Date.now()
        }ms)`,
      );
      return;
    }

    try {
      await this.prisma.errorSistema.create({
        data: {
          tenantCodigo: data.tenantCodigo ?? null,
          mensaje: truncar(data.mensaje || 'Error sin mensaje', 2000) ?? 'Error',
          tipo: truncar(data.tipo, 120),
          stack: truncar(data.stack, 8000),
          ruta: truncar(data.ruta, 500),
          metodo: data.metodo ?? null,
          statusCode: data.statusCode ?? null,
          usuarioId: data.usuarioId ?? null,
          usuarioNombre: truncar(data.usuarioNombre, 200),
          sucursalId: data.sucursalId ?? null,
          ip: truncar(data.ip, 45),
          userAgent: truncar(data.userAgent, 500),
          requestBody:
            data.requestBody != null ? (sanearBody(data.requestBody) ?? Prisma.JsonNull) : Prisma.JsonNull,
          requestQuery:
            data.requestQuery != null ? (sanearBody(data.requestQuery) ?? Prisma.JsonNull) : Prisma.JsonNull,
          replica: truncar(data.replica || REPLICA, 120),
          severidad: data.severidad ?? 'error',
        },
      });
      if (dbLogCooldownUntil !== 0) dbLogCooldownUntil = 0;
    } catch (err) {
      if (esErrorConexionPg(err)) {
        dbLogCooldownUntil = Date.now() + COOLDOWN_MS;
        this.logger.error(
          `[LogSistema] INSERT fallo por timeout de pool — abriendo circuit breaker (cooldown ${COOLDOWN_MS}ms)`,
        );
        return;
      }
      this.logger.error(
        { err: (err as Error)?.message },
        '[LogSistema] No se pudo persistir error en errores_sistema',
      );
    }
  }

  async listar(query: ConsultaLogs, tenantCodigo: string) {
    const pagina = Math.max(1, parseInt(String(query.pagina ?? '1'), 10) || 1);
    const limite = Math.min(
      100,
      Math.max(1, parseInt(String(query.limite ?? '30'), 10) || 30),
    );

    const where: Prisma.ErrorSistemaWhereInput = {
      // Multi-tenant: cada tenant ve los suyos + los huérfanos (sin tenant resuelto).
      OR: [{ tenantCodigo }, { tenantCodigo: null }],
    };
    const andClauses: Prisma.ErrorSistemaWhereInput[] = [];

    if (query.buscar) {
      const palabras = String(query.buscar).trim().split(/\s+/).filter(Boolean).slice(0, 5);
      for (const palabra of palabras) {
        andClauses.push({
          OR: [
            { mensaje: { contains: palabra, mode: 'insensitive' } },
            { ruta: { contains: palabra, mode: 'insensitive' } },
            { tipo: { contains: palabra, mode: 'insensitive' } },
          ],
        });
      }
    }
    if (query.statusCode) {
      const n = parseInt(String(query.statusCode), 10);
      if (Number.isFinite(n)) andClauses.push({ statusCode: n });
    }
    if (query.metodo) andClauses.push({ metodo: String(query.metodo).toUpperCase() });
    if (query.severidad) andClauses.push({ severidad: query.severidad });
    if (query.usuarioId) andClauses.push({ usuarioId: query.usuarioId });
    if (query.sucursalId) andClauses.push({ sucursalId: query.sucursalId });
    if (query.replica)
      andClauses.push({ replica: { contains: String(query.replica), mode: 'insensitive' } });
    if (
      query.soloNoResueltos === true ||
      query.soloNoResueltos === 'true' ||
      query.soloNoResueltos === '1'
    ) {
      andClauses.push({ resuelto: false });
    }
    if (query.desde) andClauses.push({ creadoEn: { gte: new Date(query.desde) } });
    if (query.hasta) andClauses.push({ creadoEn: { lte: new Date(query.hasta) } });

    if (andClauses.length) where.AND = andClauses;

    const [datos, total] = await Promise.all([
      this.prisma.errorSistema.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      this.prisma.errorSistema.count({ where }),
    ]);

    return {
      datos,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  }

  async obtenerPorId(id: string, tenantCodigo: string) {
    const error = await this.prisma.errorSistema.findFirst({
      where: { id, OR: [{ tenantCodigo }, { tenantCodigo: null }] },
    });
    return error;
  }

  async estadisticas(tenantCodigo: string) {
    const where: Prisma.ErrorSistemaWhereInput = {
      OR: [{ tenantCodigo }, { tenantCodigo: null }],
    };
    const desdeHora = new Date(Date.now() - 60 * 60 * 1000);
    const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, noResueltos, criticos, ultimas24h, ultimaHora] = await Promise.all([
      this.prisma.errorSistema.count({ where }),
      this.prisma.errorSistema.count({ where: { ...where, resuelto: false } }),
      this.prisma.errorSistema.count({ where: { ...where, severidad: 'critical' } }),
      this.prisma.errorSistema.count({ where: { ...where, creadoEn: { gte: desde24h } } }),
      this.prisma.errorSistema.count({ where: { ...where, creadoEn: { gte: desdeHora } } }),
    ]);

    return { total, noResueltos, criticos, ultimas24h, ultimaHora };
  }

  async marcarResuelto(id: string, usuarioId: string, notas?: string) {
    return this.prisma.errorSistema.update({
      where: { id },
      data: {
        resuelto: true,
        resueltoEn: new Date(),
        resueltoPor: usuarioId,
        notasResolucion: notas ?? null,
      },
    });
  }

  async marcarNoResuelto(id: string) {
    return this.prisma.errorSistema.update({
      where: { id },
      data: {
        resuelto: false,
        resueltoEn: null,
        resueltoPor: null,
        notasResolucion: null,
      },
    });
  }

  async eliminar(id: string) {
    await this.prisma.errorSistema.delete({ where: { id } });
    return { eliminado: true };
  }

  async purgarAntiguos(diasResueltos = 30, diasNoResueltos = 90) {
    const cutoffResueltos = new Date(Date.now() - diasResueltos * 24 * 60 * 60 * 1000);
    const cutoffNoResueltos = new Date(Date.now() - diasNoResueltos * 24 * 60 * 60 * 1000);
    const r = await this.prisma.errorSistema.deleteMany({
      where: {
        OR: [
          { resuelto: true, creadoEn: { lt: cutoffResueltos } },
          { resuelto: false, creadoEn: { lt: cutoffNoResueltos } },
        ],
      },
    });
    return { eliminados: r.count };
  }
}
