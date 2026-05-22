'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obtener, actualizar } from '@/lib/api/client';

/**
 * Preferencias de UI persistidas por usuario en backend.
 * Cache local con react-query + sync remoto con debounce de 600ms.
 * Mientras carga la respuesta inicial, usa localStorage como fallback rápido.
 */
export function usePreferencias<T>(modulo: string, valorPorDefecto: T) {
  const qc = useQueryClient();
  const claveLocal = `ropas.prefs.${modulo}`;

  const { data: todas } = useQuery({
    queryKey: ['preferencias'],
    queryFn: () => obtener<Record<string, unknown>>('/preferencias'),
    staleTime: 60_000,
    retry: false,
  });

  const remoto = todas ? (todas[modulo] as T | undefined) : undefined;

  // Fallback localStorage para primer render mientras carga el backend.
  const [estado, setEstado] = React.useState<T>(() => {
    if (typeof window === 'undefined') return valorPorDefecto;
    try {
      const raw = localStorage.getItem(claveLocal);
      if (raw) return JSON.parse(raw) as T;
    } catch { /* ignore */ }
    return valorPorDefecto;
  });

  // Cuando llega lo remoto, override el local.
  const aplicadoRef = React.useRef(false);
  React.useEffect(() => {
    if (remoto !== undefined && !aplicadoRef.current) {
      setEstado(remoto);
      aplicadoRef.current = true;
    }
  }, [remoto]);

  const guardar = useMutation({
    mutationFn: (estado: T) => actualizar(`/preferencias/${modulo}`, { estado }),
    onSuccess: datos => {
      qc.setQueryData(['preferencias'], datos);
    },
  });

  // Debounce: guarda 600ms después del último cambio.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const actualizarEstado = React.useCallback(
    (siguiente: T | ((prev: T) => T)) => {
      setEstado(prev => {
        const next = typeof siguiente === 'function'
          ? (siguiente as (p: T) => T)(prev)
          : siguiente;
        if (typeof window !== 'undefined') {
          try { localStorage.setItem(claveLocal, JSON.stringify(next)); } catch { /* ignore */ }
        }
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          guardar.mutate(next);
        }, 600);
        return next;
      });
    },
    [claveLocal, guardar],
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [estado, actualizarEstado] as const;
}
