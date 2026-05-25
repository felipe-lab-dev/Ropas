import type { NextConfig } from 'next';

// Static export para Azure Static Web Apps. Sin SSR ni route handlers:
// toda mutacion va al backend NestJS via NEXT_PUBLIC_API_URL.
const E2E = process.env.NEXT_E2E === '1';

const config: NextConfig = {
  // En modo E2E desactivamos StrictMode (double-mount de dev rompe
  // los fills consecutivos de Playwright) y desactivamos `output: export`
  // (que requiere generateStaticParams para CADA ID dinámico, incompatible
  // con rutas creadas en runtime). Producción no se ve afectada.
  reactStrictMode: !E2E,
  ...(E2E ? {} : { output: 'export' as const }),
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default config;
