import { create } from 'zustand';
import { obtener } from '@/lib/api/client';

interface ConfigSaas {
  tenant: { codigo: string; nombre: string };
  plan: { nombre: string; limites: Record<string, number> };
  modulosHabilitados: string[];
  accesoPermitido: boolean;
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
