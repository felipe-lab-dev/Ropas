import type { NextConfig } from 'next';

// Static export para Azure Static Web Apps. Sin SSR ni route handlers:
// toda mutacion va al backend NestJS via NEXT_PUBLIC_API_URL.
const E2E = process.env.NEXT_E2E === '1';

const config: NextConfig = {
  // StrictMode causa double-mount en dev y rompe los fills consecutivos
  // de Playwright. En modo E2E (NEXT_E2E=1) se desactiva. Producción no
  // se ve afectada (StrictMode no aplica en build de producción).
  reactStrictMode: !E2E,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default config;
