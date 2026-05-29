import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useSesion } from '@/lib/store/sesion';
import { obtenerApiUrl, obtenerTenantCode } from '@/lib/tenant';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
});

api.interceptors.request.use(config => {
  config.baseURL = `${obtenerApiUrl()}/api/v1`;
  config.headers['X-Tenant-Code'] = obtenerTenantCode();
  const token = useSesion.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Refresh-then-retry sobre 401 ────────────────────────────────────────
//
// El access token vive 15 min (JWT_ACCESS_EXPIRES_IN), el refresh 7 días.
// Cuando una request devuelve 401, intentamos UNA vez renovar el access con
// el refresh; si funciona, reintentamos el request original transparentemente.
// Solo si el refresh también falla limpiamos la sesion y redirigimos a /login.
//
// Cuando el access expira y el usuario hace varias requests en simultáneo,
// solo la primera dispara /auth/refresh y las demás se quedan esperando
// (`refreshPromise`) para no provocar una avalancha de refresh ni invalidar
// el refresh token a media renovación.
//
// Endpoints sin token (login, refresh) no entran a este flujo: la marca
// `_retry` evita loops infinitos si /refresh devuelve 401.
type ConfigConReintento = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

async function refrescarAccess(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const { refreshToken } = useSesion.getState();
  if (!refreshToken) throw new Error('Sin refresh token');

  refreshPromise = (async () => {
    try {
      const { data } = await axios.post<{ datos: { accessToken: string } }>(
        `${obtenerApiUrl()}/api/v1/auth/refresh`,
        { refreshToken },
        { headers: { 'X-Tenant-Code': obtenerTenantCode() }, timeout: 10_000 },
      );
      const nuevoAccess = data?.datos?.accessToken;
      if (!nuevoAccess) throw new Error('Respuesta de refresh sin token');
      useSesion.getState().setAccessToken(nuevoAccess);
      return nuevoAccess;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function forzarLogout() {
  useSesion.getState().limpiar();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  res => res,
  async (err: AxiosError<{ exito: boolean; mensaje?: string }>) => {
    const original = err.config as ConfigConReintento | undefined;
    const status = err.response?.status;

    // Sin config (network error, etc.) → propagar.
    if (!original || status !== 401) return Promise.reject(err);

    // El propio /auth/refresh devolvió 401 → refresh token caducó/inválido.
    // No intentar de nuevo, salir.
    const url = (original.url ?? '').toString();
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
      forzarLogout();
      return Promise.reject(err);
    }

    if (original._retry) {
      // Ya reintentamos esta request una vez y volvió a fallar — abandonamos.
      forzarLogout();
      return Promise.reject(err);
    }
    original._retry = true;

    try {
      const nuevoAccess = await refrescarAccess();
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${nuevoAccess}`;
      return api.request(original);
    } catch {
      forzarLogout();
      return Promise.reject(err);
    }
  },
);

export interface RespuestaApi<T> {
  exito: true;
  datos: T;
  mensaje?: string;
}
export interface RespuestaPaginada<T> {
  exito: true;
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export async function obtener<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<RespuestaApi<T>>(url, config);
  return data.datos;
}
export async function obtenerPaginado<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<RespuestaPaginada<T>> {
  const { data } = await api.get<RespuestaPaginada<T>>(url, { params });
  return data;
}
export async function postear<T, B = unknown>(url: string, body?: B): Promise<T> {
  const { data } = await api.post<RespuestaApi<T>>(url, body);
  return data.datos;
}
export async function actualizar<T, B = unknown>(url: string, body?: B): Promise<T> {
  const { data } = await api.patch<RespuestaApi<T>>(url, body);
  return data.datos;
}
export async function eliminar<T = void>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.delete<RespuestaApi<T>>(url, config);
  return (data as RespuestaApi<T>)?.datos as T;
}

export async function subirArchivos<T>(
  url: string,
  archivos: File[],
  campo = 'archivos',
): Promise<T> {
  const fd = new FormData();
  for (const a of archivos) fd.append(campo, a);
  const { data } = await api.post<RespuestaApi<T>>(url, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.datos;
}

export function mensajeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.mensaje ?? err.message ?? 'Error de red';
  }
  return 'Error inesperado';
}
