/**
 * Hooks TanStack Query para configuración de facturación electrónica.
 *
 * useConfiguracionFacturacion  — GET configuración actual del tenant.
 * useGuardarConfiguracionFacturacion — PUT para guardar/actualizar configuración.
 *
 * SEGURIDAD: el backend NUNCA devuelve el token Mifact en plano.
 * Solo se expone tokenConfigurado: boolean.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obtener, mensajeError } from '@/lib/api/client';
import { api } from '@/lib/api/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ConfiguracionFacturacion {
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccionFiscal: string;
  ubigeoFiscalCodigo: string;
  mifactBaseUrl: string;
  /** El token NUNCA viene en plano del backend — solo este booleano */
  tokenConfigurado: boolean;
  enviarAutomaticoASunat: boolean;
  emitirAlConfirmar: boolean;
  retornarPdf: boolean;
  retornarXmlEnvio: boolean;
  retornarXmlCdr: boolean;
  formatoImpresion: string;
  correoNotificacion: string | null;
}

export interface GuardarConfiguracionFacturacionInput {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccionFiscal: string;
  ubigeoFiscalCodigo: string;
  /** Omitir o dejar vacío para mantener el token existente */
  mifactToken?: string;
  mifactBaseUrl?: string;
  enviarAutomaticoASunat?: boolean;
  emitirAlConfirmar?: boolean;
  retornarPdf?: boolean;
  retornarXmlEnvio?: boolean;
  retornarXmlCdr?: boolean;
  formatoImpresion?: string;
  correoNotificacion?: string | null;
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const configuracionFacturacionKey = ['configuracion-facturacion'] as const;

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Obtiene la configuración de facturación del tenant.
 * Retorna null si no hay configuración (tenant aún no configurado).
 */
export function useConfiguracionFacturacion() {
  return useQuery<ConfiguracionFacturacion | null>({
    queryKey: configuracionFacturacionKey,
    queryFn: () => obtener<ConfiguracionFacturacion | null>('/configuracion-facturacion'),
  });
}

/**
 * Guarda/actualiza la configuración de facturación.
 * Invalida el query de obtener al tener éxito.
 */
export function useGuardarConfiguracionFacturacion() {
  const qc = useQueryClient();
  return useMutation<ConfiguracionFacturacion, Error, GuardarConfiguracionFacturacionInput>({
    mutationFn: async (dto) => {
      const { data } = await api.put<{ exito: boolean; datos: ConfiguracionFacturacion }>(
        '/api/v1/configuracion-facturacion',
        dto,
      );
      return data.datos;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: configuracionFacturacionKey });
    },
  });
}
