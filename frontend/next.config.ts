import type { NextConfig } from 'next';

// Static export para Azure Static Web Apps. Sin SSR ni route handlers:
// toda mutacion va al backend NestJS via NEXT_PUBLIC_API_URL.
const config: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default config;
