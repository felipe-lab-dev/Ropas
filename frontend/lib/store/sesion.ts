import * as React from 'react';
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
  // Sobreescribe solo el access token tras un refresh exitoso.
  setAccessToken: (token: string) => void;
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
      setAccessToken: token => set({ accessToken: token }),
      limpiar: () => set({ accessToken: null, refreshToken: null, usuario: null }),
    }),
    { name: 'ropas.sesion' },
  ),
);

/**
 * Hook que indica si zustand persist terminó de hidratar desde localStorage.
 * Útil para componentes que necesitan saber si el estado inicial (usuario null)
 * es real o solo "todavía no hidraté".
 *
 * Sin esto, el shell layout puede redirigir a /login antes de leer el token
 * persistido (flash visible al recargar la página estando logueado).
 */
export function useSesionHidratada(): boolean {
  // En SSR `persist` puede no estar disponible — devolvemos false para que
  // el shell no decida nada hasta el primer render en cliente.
  const safeHasHydrated = () => {
    const p = (useSesion as unknown as { persist?: { hasHydrated?: () => boolean; onFinishHydration?: (cb: () => void) => () => void } }).persist;
    return p?.hasHydrated?.() ?? false;
  };
  const [hidratada, setHidratada] = React.useState(false);
  React.useEffect(() => {
    setHidratada(safeHasHydrated());
    const p = (useSesion as unknown as { persist?: { onFinishHydration?: (cb: () => void) => () => void } }).persist;
    if (!p?.onFinishHydration) return;
    const off = p.onFinishHydration(() => setHidratada(true));
    return off;
  }, []);
  return hidratada;
}

export function tienePermiso(permisos: string[] | undefined, requerido: string): boolean {
  if (!permisos) return false;
  return permisos.includes('*') || permisos.includes(requerido);
}
