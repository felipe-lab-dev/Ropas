import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { useSesion } from '@/lib/store/sesion';

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const tenantCode = process.env.NEXT_PUBLIC_TENANT_CODE ?? 'mi-tienda';

export const api = axios.create({
  baseURL: `${baseURL}/api/v1`,
  headers: { 'X-Tenant-Code': tenantCode },
  timeout: 15_000,
});

api.interceptors.request.use(config => {
  const token = useSesion.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  (err: AxiosError<{ exito: boolean; mensaje?: string }>) => {
    if (err.response?.status === 401) {
      useSesion.getState().limpiar();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
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
export async function eliminar(url: string): Promise<void> {
  await api.delete(url);
}

export function mensajeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.mensaje ?? err.message ?? 'Error de red';
  }
  return 'Error inesperado';
}
