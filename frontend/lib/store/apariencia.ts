import { create } from 'zustand';

import { DEFAULT_LOGO_SVG } from '@/lib/default-logo-svg';

export type Paleta = 'lavanda' | 'oceano' | 'esmeralda' | 'rosa' | 'ambar' | 'indigo' | 'cerezo';

interface EstadoApariencia {
  tema: 'light' | 'dark';
  paleta: Paleta;
  fontSize: number;
  familiaFuente: string;
  logoSvg: string;
  nombreApp: string;
  subtituloApp: string;
  hidratado: boolean;
  setTema: (t: 'light' | 'dark') => void;
  setPaleta: (p: Paleta) => void;
  setFontSize: (n: number) => void;
  setFamiliaFuente: (f: string) => void;
  setLogoSvg: (s: string) => void;
  setNombreApp: (s: string) => void;
  setSubtituloApp: (s: string) => void;
  /**
   * Aplica el branding tenant-level traído del servidor (/saas/mi-config).
   * El server gana sobre lo guardado en este navegador para logo/nombre/eslogan
   * (son datos de la tienda, compartidos). Solo pisa cuando el server trae valor.
   */
  setBrandingServidor: (b: { logoSvg?: string | null; nombre?: string | null; subtitulo?: string | null }) => void;
  hidratar: () => void;
}

const STORAGE_KEY = 'ropas.apariencia';

export const useApariencia = create<EstadoApariencia>()((set, get) => ({
  tema: 'dark',
  paleta: 'lavanda',
  fontSize: 14,
  familiaFuente: '',
  logoSvg: DEFAULT_LOGO_SVG,
  nombreApp: 'Ropas',
  subtituloApp: 'Vende más rápido. Controla tu tienda.',
  hidratado: false,
  setTema: tema => { set({ tema }); persistir(get()); },
  setPaleta: paleta => { set({ paleta }); persistir(get()); },
  setFontSize: fontSize => { set({ fontSize }); persistir(get()); },
  setFamiliaFuente: familiaFuente => { set({ familiaFuente }); persistir(get()); },
  setLogoSvg: logoSvg => { set({ logoSvg }); persistir(get()); },
  setNombreApp: nombreApp => { set({ nombreApp }); persistir(get()); },
  setSubtituloApp: subtituloApp => { set({ subtituloApp }); persistir(get()); },
  setBrandingServidor: b => {
    const s = get();
    set({
      logoSvg: b.logoSvg ?? s.logoSvg,
      nombreApp: b.nombre ?? s.nombreApp,
      subtituloApp: b.subtitulo ?? s.subtituloApp,
    });
    persistir(get());
  },
  hidratar: () => {
    if (typeof window === 'undefined' || get().hidratado) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EstadoApariencia>;
        set({
          tema: parsed.tema ?? 'dark',
          paleta: parsed.paleta ?? 'lavanda',
          fontSize: parsed.fontSize ?? 14,
          familiaFuente: parsed.familiaFuente ?? '',
          logoSvg: parsed.logoSvg ?? DEFAULT_LOGO_SVG,
          nombreApp: parsed.nombreApp ?? 'Ropas',
          subtituloApp: parsed.subtituloApp ?? 'Vende más rápido. Controla tu tienda.',
          hidratado: true,
        });
      } else {
        set({ hidratado: true });
      }
    } catch {
      set({ hidratado: true });
    }
  },
}));

function persistir(s: EstadoApariencia) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      tema: s.tema,
      paleta: s.paleta,
      fontSize: s.fontSize,
      familiaFuente: s.familiaFuente,
      logoSvg: s.logoSvg,
      nombreApp: s.nombreApp,
      subtituloApp: s.subtituloApp,
    }),
  );
}

export const PALETAS: Array<{ id: Paleta; nombre: string; preview: [string, string] }> = [
  { id: 'lavanda', nombre: 'Lavanda', preview: ['#9061d8', '#d4a657'] },
  { id: 'oceano', nombre: 'Océano', preview: ['#2196d6', '#26b3a8'] },
  { id: 'esmeralda', nombre: 'Esmeralda', preview: ['#2ba572', '#e0b03b'] },
  { id: 'rosa', nombre: 'Rosa', preview: ['#e0508a', '#a96bc4'] },
  { id: 'ambar', nombre: 'Ámbar', preview: ['#ed8a18', '#e36b3c'] },
  { id: 'indigo', nombre: 'Índigo', preview: ['#5b73d3', '#2cb1d8'] },
  { id: 'cerezo', nombre: 'Cerezo', preview: ['#c83838', '#e89d2d'] },
];
