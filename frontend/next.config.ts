import type { NextConfig } from 'next';

// Static export para Azure Static Web Apps. Sin SSR ni route handlers:
// toda mutacion va al backend NestJS via NEXT_PUBLIC_API_URL.
const E2E = process.env.NEXT_E2E === '1';
const IS_PROD_BUILD = process.env.NODE_ENV === 'production';

const config: NextConfig = {
  // `output: 'export'` requiere generateStaticParams para CADA ID dinámico
  // (incompatible con rutas creadas en runtime). Solo lo activamos en build
  // de producción real; en dev y E2E corremos modo SSR normal para que las
  // rutas /ventas/[id], /clientes/[id], etc. resuelvan IDs arbitrarios.
  reactStrictMode: !E2E,
  ...(!E2E && IS_PROD_BUILD ? { output: 'export' as const } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default config;
