import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  permisos: string[];
  sucursalDefecto?: string | null;
}

interface EstadoSesion {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: UsuarioSesion | null;
  setSesion: (s: { accessToken: string; refreshToken: string; usuario: UsuarioSesion }) => void;
  limpiar: () => void;
}

export const useSesion = create<EstadoSesion>()(
  persist(
    set => ({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      setSesion: s =>
        set({ accessToken: s.accessToken, refreshToken: s.refreshToken, usuario: s.usuario }),
      limpiar: () => set({ accessToken: null, refreshToken: null, usuario: null }),
    }),
    { name: 'ropas.sesion' },
  ),
);

export function tienePermiso(permisos: string[] | undefined, requerido: string): boolean {
  if (!permisos) return false;
  return permisos.includes('*') || permisos.includes(requerido);
}
