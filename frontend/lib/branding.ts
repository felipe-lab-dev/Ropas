import { api, obtener } from '@/lib/api/client';

/** Branding público de una tienda (lo sirve el backend en /branding/:codigo). */
export interface BrandingPublico {
  codigo: string;
  nombre: string;
  subtitulo: string | null;
  logoSvg: string | null;
  tenantEncontrado: boolean;
}

export interface TiendaResumen {
  codigo: string;
  nombre: string;
}

/** Lista de tiendas para el selector del login (vacía en producción). */
export function listarTiendas(): Promise<TiendaResumen[]> {
  return obtener<TiendaResumen[]>('/branding/tiendas');
}

/** Branding público de una tienda por código (pre-auth). */
export function obtenerBranding(codigo: string): Promise<BrandingPublico> {
  return obtener<BrandingPublico>(`/branding/${encodeURIComponent(codigo)}`);
}

export interface GuardarBrandingInput {
  logoSvg?: string | null;
  nombre?: string | null;
  subtitulo?: string | null;
}

/** Persiste la identidad de la tienda (requiere permiso configuracion:editar). */
export async function guardarBranding(input: GuardarBrandingInput): Promise<BrandingPublico> {
  const { data } = await api.put<{ datos: BrandingPublico }>('/configuracion/branding', input);
  return data.datos;
}
