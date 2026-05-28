'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/shell/sidebar';
import { Header } from '@/components/shell/header';
import { OnboardingModal } from '@/components/shell/onboarding-modal';
import { MobileNav } from '@/components/shell/mobile-nav';
import { MobileDrawer } from '@/components/shell/mobile-drawer';
import { useSesion, useSesionHidratada } from '@/lib/store/sesion';
import { useConfigSaas } from '@/lib/store/config-saas';
import { motion } from 'framer-motion';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const usuario = useSesion(s => s.usuario);
  const hidratada = useSesionHidratada();
  const cargarConfig = useConfigSaas(s => s.cargar);
  const config = useConfigSaas(s => s.config);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    // Evita el flash de /login al recargar estando logueado:
    // esperamos a que zustand persist termine de hidratar antes de decidir.
    if (hidratada && !usuario) router.replace('/login');
  }, [hidratada, usuario, router]);

  React.useEffect(() => {
    if (usuario) void cargarConfig();
  }, [usuario, cargarConfig]);

  if (!hidratada) return null; // aún hidratando — no decidir todavía
  if (!usuario) return null;

  if (config && !config.accesoPermitido) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Suscripción suspendida</h1>
          <p className="text-[hsl(var(--text-muted))]">
            Contacta al administrador para reactivar el acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[hsl(var(--bg))] text-[hsl(var(--text))]">
      <div className="hidden lg:flex h-full">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header onOpenMenu={() => setDrawerOpen(true)} />
        <main
          className="flex-1 overflow-auto scrollbar-thin pb-16 lg:pb-0"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
        >
          <motion.div
            key={typeof window !== 'undefined' ? window.location.pathname : ''}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8"
            style={{
              paddingLeft: 'max(1rem, env(safe-area-inset-left))',
              paddingRight: 'max(1rem, env(safe-area-inset-right))',
            }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      <MobileNav onOpenMenu={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <OnboardingModal />
    </div>
  );
}
