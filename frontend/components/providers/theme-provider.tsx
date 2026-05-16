'use client';

import * as React from 'react';
import { useApariencia } from '@/lib/store/apariencia';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const tema = useApariencia(s => s.tema);
  const fontSize = useApariencia(s => s.fontSize);
  const familiaFuente = useApariencia(s => s.familiaFuente);
  const hidratar = useApariencia(s => s.hidratar);

  React.useEffect(() => {
    hidratar();
  }, [hidratar]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    if (familiaFuente) {
      document.documentElement.style.setProperty('--font-sans', familiaFuente);
    }
  }, [tema, fontSize, familiaFuente]);

  return <>{children}</>;
}
