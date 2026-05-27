/**
 * Catálogo UBIGEO Perú — referencia SUNAT.
 *
 * Vive como JSON estático en el repo, no en DB. Razones:
 *  - Es data del estado peruano, idéntica para todos los tenants.
 *  - Cambia cada 5+ años (decreto-level). Updates = git pull + redeploy.
 *  - Tamaño chico (~2,800 distritos, ~150 KB JSON), cabe en memoria.
 *  - Lookup O(1) por código y búsqueda lineal sobre 2,800 items es < 1 ms.
 *
 * Si SUNAT publica una actualización, regenerar ubigeos.json desde el archivo
 * actualizado de Mifact (o equivalente) y redesplegar.
 */
import ubigeosData from './ubigeos.json';

export interface Ubigeo {
  codigo: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

const ubigeos: readonly Ubigeo[] = ubigeosData;
const indicePorCodigo = new Map(ubigeos.map((u) => [u.codigo, u]));

export function listarUbigeos(): readonly Ubigeo[] {
  return ubigeos;
}

export function obtenerUbigeo(codigo: string): Ubigeo | undefined {
  return indicePorCodigo.get(codigo);
}

export function ubigeoExiste(codigo: string): boolean {
  return indicePorCodigo.has(codigo);
}

/**
 * Búsqueda case-insensitive contra distrito + provincia + departamento.
 * Útil para autocomplete en frontend.
 */
export function buscarUbigeos(query: string, limite = 20): readonly Ubigeo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const resultados: Ubigeo[] = [];
  for (const u of ubigeos) {
    const hay = `${u.distrito} ${u.provincia} ${u.departamento}`.toLowerCase();
    if (hay.includes(q)) {
      resultados.push(u);
      if (resultados.length >= limite) break;
    }
  }
  return resultados;
}

export function listarDepartamentos(): readonly string[] {
  return Array.from(new Set(ubigeos.map((u) => u.departamento))).sort();
}

export function listarProvincias(departamento: string): readonly string[] {
  return Array.from(
    new Set(
      ubigeos.filter((u) => u.departamento === departamento).map((u) => u.provincia),
    ),
  ).sort();
}

export function listarDistritos(
  departamento: string,
  provincia: string,
): readonly Ubigeo[] {
  return ubigeos.filter(
    (u) => u.departamento === departamento && u.provincia === provincia,
  );
}
