/**
 * Hook reutilizable para resolver la sesión de caja abierta del cajero actual
 * en una sucursal dada.
 *
 * Contrato de datos:
 *   - data === undefined  → query no disparada aún (sucursalId vacío) o cargando
 *   - data === null       → query resuelta, NO hay sesión abierta  ← bloqueante
 *   - data === { id, … }  → sesión abierta disponible
 *
 * La queryKey ['caja-mi-sesion', sucursalId] es compartida con pos/page.tsx y
 * caja/page.tsx, por lo que se aprovecha el cache de React Query entre páginas.
 */
import { useQuery } from '@tanstack/react-query';
import { obtener } from '@/lib/api/client';

export interface SesionCajaResumen {
  id: string;
  sucursal: { id: string; nombre: string };
  cajero: { id: string; nombre: string };
  abiertaEn: string;
}

/**
 * @param sucursalId  ID de sucursal; si es falsy la query no se dispara.
 */
export function useSesionCajaAbierta(sucursalId: string | undefined) {
  return useQuery({
    queryKey: ['caja-mi-sesion', sucursalId],
    queryFn: () =>
      obtener<SesionCajaResumen | null>('/caja/mi-sesion-abierta', {
        params: { sucursalId },
      }),
    enabled: !!sucursalId,
    retry: false,
  });
}
