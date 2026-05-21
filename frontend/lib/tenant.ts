// Extracción del tenant en runtime (cliente).
// Sirve la misma build estática a cualquier subdominio *.tienda.enkihubs.com
// y resuelve el tenant desde window.location.host en cada request.

const DOMINIO_BASE = 'tienda.enkihubs.com';
const TENANT_DEV = process.env.NEXT_PUBLIC_TENANT_CODE ?? 'mi-tienda';

export function obtenerTenantCode(): string {
  if (typeof window === 'undefined') return TENANT_DEV;

  const host = window.location.hostname.toLowerCase();

  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return TENANT_DEV;
  }

  if (host.endsWith(`.${DOMINIO_BASE}`)) {
    return host.slice(0, host.length - DOMINIO_BASE.length - 1);
  }

  if (host.endsWith('.azurestaticapps.net')) {
    return TENANT_DEV;
  }

  return host.split('.')[0] ?? TENANT_DEV;
}

export function obtenerApiUrl(): string {
  // En el browser SIEMPRE resolvemos por window.location — la env NEXT_PUBLIC_API_URL
  // del `.env` no debe ganarle al host real (sino producción termina llamando a localhost).
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    }
    // Pattern per-tenant (idem Velarde): <tenant>.tienda.enkihubs.com → api.<tenant>.tienda.enkihubs.com
    if (host.endsWith(`.${DOMINIO_BASE}`)) {
      const tenant = host.slice(0, host.length - DOMINIO_BASE.length - 1);
      return `https://api.${tenant}.${DOMINIO_BASE}`;
    }
    // SWA default (staging) o cualquier otro host: API compartida.
    return `https://api.${DOMINIO_BASE}`;
  }
  // SSR / build: usar env si está, fallback a localhost para dev.
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}
