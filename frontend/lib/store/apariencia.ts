import { create } from 'zustand';

interface EstadoApariencia {
  tema: 'light' | 'dark';
  fontSize: number;
  familiaFuente: string;
  hidratado: boolean;
  setTema: (t: 'light' | 'dark') => void;
  setFontSize: (n: number) => void;
  setFamiliaFuente: (f: string) => void;
  hidratar: () => void;
}

const STORAGE_KEY = 'ropas.apariencia';

export const useApariencia = create<EstadoApariencia>()((set, get) => ({
  tema: 'dark',
  fontSize: 14,
  familiaFuente: '',
  hidratado: false,
  setTema: tema => {
    set({ tema });
    persistir(get());
  },
  setFontSize: fontSize => {
    set({ fontSize });
    persistir(get());
  },
  setFamiliaFuente: familiaFuente => {
    set({ familiaFuente });
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
          fontSize: parsed.fontSize ?? 14,
          familiaFuente: parsed.familiaFuente ?? '',
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
    JSON.stringify({ tema: s.tema, fontSize: s.fontSize, familiaFuente: s.familiaFuente }),
  );
}
