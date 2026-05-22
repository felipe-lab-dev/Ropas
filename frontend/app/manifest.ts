import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ropas — ERP',
    short_name: 'Ropas',
    description: 'ERP para venta de ropa — gestión multi-tenant',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f0a18',
    theme_color: '#7c5cd9',
    lang: 'es-PE',
    categories: ['business', 'productivity', 'shopping'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: 'Punto de Venta', url: '/pos', short_name: 'POS' },
      { name: 'Caja', url: '/caja' },
      { name: 'Productos', url: '/productos' },
    ],
  };
}
