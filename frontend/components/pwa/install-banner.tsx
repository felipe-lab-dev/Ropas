'use client';

import * as React from 'react';
import { Download, Share, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DIAS = 10;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type Plataforma = 'chromium' | 'ios-safari' | 'macos-safari' | 'firefox' | 'otro';

function detectarPlataforma(): Plataforma {
  if (typeof window === 'undefined') return 'otro';
  const ua = window.navigator.userAgent;
  const esIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  if (esIOS) return 'ios-safari';
  const esSafariMac = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  if (esSafariMac) return 'macos-safari';
  if (/Firefox/.test(ua)) return 'firefox';
  return 'chromium';
}

function yaInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const navStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return navStandalone === true;
}

function dismissedRecientemente(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    const dias = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return dias < DISMISS_DIAS;
  } catch {
    return false;
  }
}

export function InstallPwaBanner() {
  const [plataforma, setPlataforma] = React.useState<Plataforma>('otro');
  const [visible, setVisible] = React.useState(false);
  const [eventoChromium, setEventoChromium] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [instalando, setInstalando] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (yaInstalada() || dismissedRecientemente()) return;

    const p = detectarPlataforma();
    setPlataforma(p);

    if (p === 'chromium') {
      const onPrompt = (e: Event) => {
        e.preventDefault();
        setEventoChromium(e as BeforeInstallPromptEvent);
        setVisible(true);
      };
      window.addEventListener('beforeinstallprompt', onPrompt);
      return () => window.removeEventListener('beforeinstallprompt', onPrompt);
    }

    // En iOS / macOS Safari / Firefox no hay evento — mostramos banner instructivo después de un pequeño delay.
    if (p === 'ios-safari' || p === 'macos-safari' || p === 'firefox') {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onInstalada = () => {
      setVisible(false);
      try { window.localStorage.removeItem(LS_KEY); } catch {}
    };
    window.addEventListener('appinstalled', onInstalada);
    return () => window.removeEventListener('appinstalled', onInstalada);
  }, []);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    try { window.localStorage.setItem(LS_KEY, String(Date.now())); } catch {}
  }, []);

  const instalarChromium = React.useCallback(async () => {
    if (!eventoChromium) return;
    setInstalando(true);
    try {
      await eventoChromium.prompt();
      const choice = await eventoChromium.userChoice;
      if (choice.outcome === 'accepted') setVisible(false);
      else dismiss();
    } finally {
      setInstalando(false);
      setEventoChromium(null);
    }
  }, [eventoChromium, dismiss]);

  if (!visible) return null;

  const baseClass = cn(
    'fixed z-50 left-1/2 -translate-x-1/2',
    'bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0',
    'w-[min(92vw,28rem)]',
    'rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]/95 backdrop-blur-xl',
    'shadow-[0_25px_60px_-15px_hsl(265_50%_4%/0.6)]',
    'animate-in fade-in slide-in-from-bottom-4 duration-300',
  );

  return (
    <div role="dialog" aria-label="Instalar Ropas" className={baseClass}>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={dismiss}
        className="absolute top-2 right-2 size-7 grid place-items-center rounded-md text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text))] transition-colors"
      >
        <X className="size-4" />
      </button>
      <div className="p-4 flex gap-3">
        <div className="shrink-0 size-11 rounded-xl bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[#ec4899] grid place-items-center text-white shadow-[0_8px_20px_-6px_hsl(var(--brand-primary)/0.6)]">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          {plataforma === 'chromium' && (
            <>
              <p className="text-sm font-semibold">Instalar Ropas</p>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                Acceso directo, modo standalone, soporte offline.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={instalarChromium} disabled={instalando}>
                  <Download className="size-3.5" /> {instalando ? 'Instalando…' : 'Instalar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>Ahora no</Button>
              </div>
            </>
          )}
          {plataforma === 'ios-safari' && (
            <>
              <p className="text-sm font-semibold">Agregar a la pantalla de inicio</p>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                Toca <Share className="inline size-3.5 align-text-bottom mx-0.5 text-[hsl(var(--brand-primary))]" />
                en la barra y luego <span className="font-semibold">&quot;Agregar a inicio&quot;</span>
                <Plus className="inline size-3.5 align-text-bottom ml-0.5" />.
              </p>
            </>
          )}
          {plataforma === 'macos-safari' && (
            <>
              <p className="text-sm font-semibold">Agregar Ropas al Dock</p>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                Menú <span className="font-semibold">Archivo → Agregar al Dock</span> (Safari 17+).
              </p>
            </>
          )}
          {plataforma === 'firefox' && (
            <>
              <p className="text-sm font-semibold">Instalar Ropas</p>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
                En Firefox: menú ⋯ → <span className="font-semibold">Instalar esta página como app</span>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
