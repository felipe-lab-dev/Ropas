'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { obtener, mensajeError } from '@/lib/api/client';

/**
 * Hook transversal para consultar RUC (SUNAT) / DNI (RENIEC) vía json.pe.
 * Reusa el backend `/utilidades/ruc/:ruc` y `/utilidades/dni/:dni`.
 * Se usa en proveedores, clientes y POS (al crear cliente durante una venta).
 */

export interface DatosRuc {
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  estado: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  ubigeo: string | null;
}

export interface DatosDni {
  dni: string;
  nombres: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  nombreCompleto: string;
}

export type EstadoConsulta = 'idle' | 'cargando' | 'ok' | 'error';

interface Opciones {
  /** No mostrar toasts (útil para autoconsulta). */
  silenciar?: boolean;
}

export function useConsultaDoc() {
  const [estado, setEstado] = React.useState<EstadoConsulta>('idle');
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  const reset = React.useCallback(() => {
    setEstado('idle');
    setMensaje(null);
  }, []);

  const consultarRuc = React.useCallback(
    async (ruc: string, opts: Opciones = {}): Promise<DatosRuc | null> => {
      const limpio = (ruc ?? '').replace(/\D+/g, '');
      if (!/^\d{11}$/.test(limpio)) {
        if (!opts.silenciar) toast.error('El RUC debe tener 11 dígitos');
        return null;
      }
      setEstado('cargando');
      setMensaje(null);
      try {
        const datos = await obtener<DatosRuc>(`/utilidades/ruc/${limpio}`);
        setEstado('ok');
        setMensaje(`SUNAT · ${datos.estado ?? 'sin estado'}`);
        if (!opts.silenciar) toast.success(`RUC encontrado: ${datos.razonSocial}`);
        return datos;
      } catch (err) {
        const m = mensajeError(err);
        setEstado('error');
        setMensaje(m);
        if (!opts.silenciar) toast.error(m);
        return null;
      }
    },
    [],
  );

  const consultarDni = React.useCallback(
    async (dni: string, opts: Opciones = {}): Promise<DatosDni | null> => {
      const limpio = (dni ?? '').replace(/\D+/g, '');
      if (!/^\d{8}$/.test(limpio)) {
        if (!opts.silenciar) toast.error('El DNI debe tener 8 dígitos');
        return null;
      }
      setEstado('cargando');
      setMensaje(null);
      try {
        const datos = await obtener<DatosDni>(`/utilidades/dni/${limpio}`);
        setEstado('ok');
        setMensaje('RENIEC · encontrado');
        if (!opts.silenciar) toast.success(`Encontrado: ${datos.nombreCompleto}`);
        return datos;
      } catch (err) {
        const m = mensajeError(err);
        setEstado('error');
        setMensaje(m);
        if (!opts.silenciar) toast.error(m);
        return null;
      }
    },
    [],
  );

  return { estado, mensaje, consultarRuc, consultarDni, reset };
}
