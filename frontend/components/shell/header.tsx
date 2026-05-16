'use client';

import * as React from 'react';
import { Search, Sun, Moon, LogOut } from 'lucide-react';
import { useApariencia } from '@/lib/store/apariencia';
import { useSesion } from '@/lib/store/sesion';
import { useConfigSaas } from '@/lib/store/config-saas';
import { Button } from '@/components/ui/button';
import { iniciales } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { CommandPalette } from './command-palette';

export function Header() {
  const tema = useApariencia(s => s.tema);
  const setTema = useApariencia(s => s.setTema);
  const usuario = useSesion(s => s.usuario);
  const limpiar = useSesion(s => s.limpiar);
  const config = useConfigSaas(s => s.config);
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cerrar = () => {
    limpiar();
    router.push('/login');
  };

  return (
    <>
      <header className="h-14 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))]/60 backdrop-blur-xl sticky top-0 z-30 flex items-center px-6 gap-4">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-3 px-3 h-9 rounded-md bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-2))]/70 border border-[hsl(var(--border))] transition-colors min-w-[280px] text-sm text-[hsl(var(--text-muted))]"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar… (Ctrl+K)</span>
          <kbd className="ml-auto rounded border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-1.5 py-0.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-3">
          {config && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[hsl(var(--text-muted))]">{config.tenant.nombre}</span>
              <span className="rounded-full bg-[hsl(var(--brand-accent))]/15 text-[hsl(var(--brand-accent))] px-2 py-0.5 font-semibold">
                {config.plan.nombre}
              </span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
            aria-label="Cambiar tema"
          >
            {tema === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {usuario && (
            <div className="flex items-center gap-2 pl-3 border-l border-[hsl(var(--border))]">
              <div className="size-8 rounded-full bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] grid place-items-center text-white text-xs font-bold">
                {iniciales(usuario.nombre)}
              </div>
              <div className="text-xs">
                <div className="font-medium">{usuario.nombre}</div>
                <div className="text-[hsl(var(--text-muted))]">{usuario.rol}</div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={cerrar} aria-label="Cerrar sesión">
                <LogOut className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
