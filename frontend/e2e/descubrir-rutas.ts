// frontend/e2e/descubrir-rutas.ts
//
// Auto-discovery de rutas leyendo el árbol del App Router de Next.
// No hay lista hardcodeada: cuando agregás una pantalla nueva (page.tsx),
// el crawler la toma sola. Si agregás una ruta [param] nueva sin estrategia
// de navegación, el crawler la reporta como OMITIDA (nunca la oculta).
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP_DIR = join(__dirname, '..', 'app');

export interface RutaDescubierta {
  /** Ruta URL derivada del archivo, p.ej. `/ventas/[id]` o `/clientes/editar`. */
  ruta: string;
  /** Contiene un segmento dinámico `[param]` (muere en deep-link por static export). */
  esDinamica: boolean;
  /** Necesita un id para renderizar contenido real (dinámica o termina en `/editar`). */
  requiereId: boolean;
  /** Lista padre desde donde se llega por click. Solo para rutas que requieren id. */
  listaPadre?: string;
}

function caminar(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) caminar(ruta, acc);
    else if (entrada === 'page.tsx') acc.push(ruta);
  }
  return acc;
}

/** Convierte el path de un `page.tsx` en su ruta URL, quitando route-groups `(grupo)`. */
function archivoARuta(archivo: string): string[] {
  return relative(APP_DIR, archivo)
    .split(sep)
    .slice(0, -1) // descarta el `page.tsx` final
    .filter((seg) => !(seg.startsWith('(') && seg.endsWith(')'))); // descarta route-groups
}

export function descubrirRutas(): RutaDescubierta[] {
  return caminar(APP_DIR)
    .map((archivo): RutaDescubierta => {
      const segmentos = archivoARuta(archivo);
      const ruta = '/' + segmentos.join('/');
      const esDinamica = segmentos.some((s) => s.startsWith('[') && s.endsWith(']'));
      // Páginas que NO son dinámicas pero igual necesitan un id por query-string
      // (convención del repo: `/x/editar?id=`, `/x/detalle?id=`). Sin id renderizan
      // vacío y darían falso positivo si se navegan directo.
      const requiereIdPorQuery = ['editar', 'detalle'].includes(segmentos.at(-1) ?? '');
      const requiereId = esDinamica || requiereIdPorQuery;
      const listaPadre = requiereId ? '/' + segmentos.slice(0, -1).join('/') : undefined;
      return { ruta: ruta === '/' ? '/' : ruta, esDinamica, requiereId, listaPadre };
    })
    // /login es público y fuera del shell autenticado: el crawler ya entra logueado.
    .filter((r) => r.ruta !== '/login')
    .sort((a, b) => a.ruta.localeCompare(b.ruta));
}
