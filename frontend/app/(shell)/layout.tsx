'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/shell/sidebar';
import { Header } from '@/components/shell/header';
import { OnboardingModal } from '@/components/shell/onboarding-modal';
import { useSesion } from '@/lib/store/sesion';
import { useConfigSaas } from '@/lib/store/config-saas';
import { motion } from 'framer-motion';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const usuario = useSesion(s => s.usuario);
  const cargarConfig = useConfigSaas(s => s.cargar);
  const config = useConfigSaas(s => s.config);

  React.useEffect(() => {
    if (!usuario) router.replace('/login');
  }, [usuario, router]);

  React.useEffect(() => {
    void cargarConfig();
  }, [cargarConfig]);

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
    <div className="flex min-h-screen bg-[hsl(var(--bg))] text-[hsl(var(--text))]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto scrollbar-thin">
          <motion.div
            key={typeof window !== 'undefined' ? window.location.pathname : ''}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
      <OnboardingModal />
    </div>
  );
}
