import { z } from 'zod';

export const PaginacionSchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().positive().max(200).default(20),
  buscar: z.string().trim().optional(),
  ordenarPor: z.string().optional(),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginacionDto = z.infer<typeof PaginacionSchema>;

export function obtenerPaginacion(query: PaginacionDto | Record<string, unknown>) {
  const pagina = Math.max(1, Number((query as any).pagina) || 1);
  const limite = Math.min(200, Math.max(1, Number((query as any).limite) || 20));
  return {
    pagina,
    limite,
    skip: (pagina - 1) * limite,
    take: limite,
  };
}

/**
 * Construye un where con búsqueda word-split sobre múltiples campos.
 * Soporta paths anidados con puntos: `'producto.nombre'` se traduce a
 * `{ producto: { nombre: { contains, mode: 'insensitive' } } }`.
 */
export function construirBusquedaWordSplit(
  texto: string | undefined,
  campos: string[],
): Record<string, unknown> | undefined {
  if (!texto) return undefined;
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return undefined;

  const construirCampo = (campo: string, palabra: string): Record<string, unknown> => {
    const partes = campo.split('.');
    const hoja: Record<string, unknown> = {
      contains: palabra,
      mode: 'insensitive' as const,
    };
    return partes.reduceRight<Record<string, unknown>>(
      (acc, parte) => ({ [parte]: acc }),
      hoja,
    );
  };

  const buildOR = (palabra: string) => ({
    OR: campos.map(campo => construirCampo(campo, palabra)),
  });

  if (palabras.length === 1) return buildOR(palabras[0]!);
  return { AND: palabras.map(buildOR) };
}
