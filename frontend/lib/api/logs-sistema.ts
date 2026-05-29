import { actualizar, eliminar, obtener, obtenerPaginado } from './client';

export type SeveridadLog = 'warn' | 'error' | 'critical';

export interface ErrorSistema {
  id: string;
  tenantCodigo: string | null;
  mensaje: string;
  tipo: string | null;
  stack: string | null;
  ruta: string | null;
  metodo: string | null;
  statusCode: number | null;
  usuarioId: string | null;
  usuarioNombre: string | null;
  sucursalId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestBody: unknown;
  requestQuery: unknown;
  replica: string | null;
  severidad: SeveridadLog;
  resuelto: boolean;
  resueltoEn: string | null;
  resueltoPor: string | null;
  notasResolucion: string | null;
  creadoEn: string;
}

export interface EstadisticasLogs {
  total: number;
  noResueltos: number;
  criticos: number;
  ultimas24h: number;
  ultimaHora: number;
}

export interface FiltroLogs {
  pagina?: number;
  limite?: number;
  buscar?: string;
  statusCode?: number | string;
  metodo?: string;
  severidad?: SeveridadLog;
  replica?: string;
  soloNoResueltos?: boolean;
  desde?: string;
  hasta?: string;
}

export const logsSistemaApi = {
  listar: (params: FiltroLogs) =>
    obtenerPaginado<ErrorSistema>('/logs-sistema', params as Record<string, unknown>),
  estadisticas: () => obtener<EstadisticasLogs>('/logs-sistema/estadisticas'),
  detalle: (id: string) => obtener<ErrorSistema>(`/logs-sistema/${id}`),
  resolver: (id: string, notas?: string) =>
    actualizar<ErrorSistema, { notas?: string }>(`/logs-sistema/${id}/resolver`, { notas }),
  noResuelto: (id: string) => actualizar<ErrorSistema>(`/logs-sistema/${id}/no-resuelto`),
  eliminar: (id: string) => eliminar(`/logs-sistema/${id}`),
  purgar: (diasResueltos?: number, diasNoResueltos?: number) =>
    eliminar<{ eliminados: number }>('/logs-sistema', {
      params: { diasResueltos, diasNoResueltos },
    }),
};

