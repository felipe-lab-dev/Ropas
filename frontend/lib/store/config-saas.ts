import { create } from 'zustand';
import { obtener } from '@/lib/api/client';
import { useApariencia } from '@/lib/store/apariencia';

interface BrandingConfig {
  codigo: string;
  nombre: string;
  subtitulo: string | null;
  logoSvg: string | null;
  tenantEncontrado: boolean;
}

interface ConfigSaas {
  tenant: { codigo: string; nombre: string };
  plan: { nombre: string; limites: Record<string, number> };
  modulosHabilitados: string[];
  accesoPermitido: boolean;
  branding?: BrandingConfig;
}

interface EstadoConfigSaas {
  config: ConfigSaas | null;
  cargando: boolean;
  cargar: () => Promise<void>;
  moduloHabilitado: (modulo: string) => boolean;
}

export const useConfigSaas = create<EstadoConfigSaas>((set, get) => ({
  config: null,
  cargando: false,
  cargar: async () => {
    if (get().cargando) return;
    set({ cargando: true });
    try {
      const config = await obtener<ConfigSaas>('/saas/mi-config');
      set({ config, cargando: false });
      // Hidratar el branding tenant-level (logo/nombre/eslogan) en apariencia.
      if (config.branding) {
        useApariencia.getState().setBrandingServidor({
          logoSvg: config.branding.logoSvg,
          nombre: config.branding.nombre,
          subtitulo: config.branding.subtitulo,
        });
      }
    } catch {
      set({ cargando: false });
    }
  },
  moduloHabilitado: modulo => {
    const c = get().config;
    if (!c) return true;
    return c.modulosHabilitados.includes(modulo);
  },
}));
