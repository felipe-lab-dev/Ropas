// Extracción del tenant en runtime (cliente).
// Sirve la misma build estática a cualquier subdominio *.tienda.enkihubs.com
// y resuelve el tenant desde window.location.host en cada request.

const DOMINIO_BASE = 'tienda.enkihubs.com';
const TENANT_DEV = process.env.NEXT_PUBLIC_TENANT_CODE ?? 'mi-tienda';
const TENANT_KEY = 'ropas.tenant';

/**
 * `true` cuando el subdominio ya fija el tenant (*.tienda.enkihubs.com): en
 * producción no se puede cambiar de tienda, igual que `tenantBloqueado` en Velarde.
 * En localhost / SWA-staging devuelve `false` → el selector del login manda.
 */
export function tenantEsFijoPorHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.toLowerCase().endsWith(`.${DOMINIO_BASE}`);
}

/** Tienda elegida en el selector del login (persistida en localStorage). */
export function getTenantSeleccionado(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TENANT_KEY);
  } catch {
    return null;
  }
}

/** Persiste la tienda elegida; las siguientes requests usan este X-Tenant-Code. */
export function setTenantCode(codigo: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TENANT_KEY, codigo);
  } catch {
    /* localStorage no disponible (modo privado, etc.) — ignorar */
  }
}

export function obtenerTenantCode(): string {
  if (typeof window === 'undefined') return TENANT_DEV;

  const host = window.location.hostname.toLowerCase();

  // Subdominio real → el host fija el tenant (no cambiable desde la UI).
  if (host.endsWith(`.${DOMINIO_BASE}`)) {
    return host.slice(0, host.length - DOMINIO_BASE.length - 1);
  }

  // Hosts no-fijos (localhost, *.local, SWA staging): manda la tienda elegida en
  // el selector del login; fallback al env de dev.
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    host.endsWith('.azurestaticapps.net')
  ) {
    return getTenantSeleccionado() ?? TENANT_DEV;
  }

  return getTenantSeleccionado() ?? host.split('.')[0] ?? TENANT_DEV;
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
