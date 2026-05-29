'use client';

import * as React from 'react';
import { useSesion } from '@/lib/store/sesion';

// Tiempos en ms. 30 min sin interactuar = logout. Aviso en los últimos 60 s.
const TIMEOUT_TOTAL_MS = 30 * 60 * 1000;
const AVISO_MS = 60 * 1000;
// El header solo muestra el countdown cuando faltan ≤ 5 min — el resto del
// tiempo no hay overlay para no distraer.
export const MOSTRAR_DESDE_MS = 5 * 60 * 1000;

const EVENTOS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'click',
];

interface EstadoInactividad {
  /** Milisegundos que faltan para el logout forzado. */
  restanteMs: number;
  /** True cuando faltan ≤ 60s y mostramos el modal de aviso. */
  avisar: boolean;
  /** Resetea el contador (usado por el botón "seguir conectado"). */
  reiniciar: () => void;
}

const CtxInactividad = React.createContext<EstadoInactividad | null>(null);

export function ProveedorInactividad({ children }: { children: React.ReactNode }) {
  const usuario = useSesion(s => s.usuario);
  const limpiar = useSesion(s => s.limpiar);

  const [restanteMs, setRestanteMs] = React.useState(TIMEOUT_TOTAL_MS);
  const ultimaActividad = React.useRef<number>(Date.now());

  const reiniciar = React.useCallback(() => {
    ultimaActividad.current = Date.now();
    setRestanteMs(TIMEOUT_TOTAL_MS);
  }, []);

  React.useEffect(() => {
    if (!usuario) return;

    const onActividad = () => {
      ultimaActividad.current = Date.now();
    };
    for (const ev of EVENTOS) window.addEventListener(ev, onActividad, { passive: true });

    const tick = window.setInterval(() => {
      const transcurrido = Date.now() - ultimaActividad.current;
      const restante = Math.max(0, TIMEOUT_TOTAL_MS - transcurrido);
      setRestanteMs(restante);
      if (restante === 0) {
        limpiar();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?motivo=inactividad';
        }
      }
    }, 1000);

    return () => {
      for (const ev of EVENTOS) window.removeEventListener(ev, onActividad);
      window.clearInterval(tick);
    };
  }, [usuario, limpiar]);

  const valor = React.useMemo<EstadoInactividad>(
    () => ({
      restanteMs,
      avisar: !!usuario && restanteMs > 0 && restanteMs <= AVISO_MS,
      reiniciar,
    }),
    [restanteMs, usuario, reiniciar],
  );

  return <CtxInactividad.Provider value={valor}>{children}</CtxInactividad.Provider>;
}

export function useInactividad(): EstadoInactividad {
  const ctx = React.useContext(CtxInactividad);
  if (!ctx) {
    // Fuera del proveedor (ej. login) — devolvemos estado neutro.
    return { restanteMs: TIMEOUT_TOTAL_MS, avisar: false, reiniciar: () => {} };
  }
  return ctx;
}

export function formatearRestante(ms: number): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSeg / 60);
  const ss = totalSeg % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}
