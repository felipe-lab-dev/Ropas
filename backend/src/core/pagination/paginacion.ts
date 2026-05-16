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

export function construirBusquedaWordSplit(
  texto: string | undefined,
  campos: string[],
): Record<string, unknown> | undefined {
  if (!texto) return undefined;
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return undefined;

  const buildOR = (palabra: string) => ({
    OR: campos.map(campo => ({
      [campo]: { contains: palabra, mode: 'insensitive' as const },
    })),
  });

  if (palabras.length === 1) return buildOR(palabras[0]!);
  return { AND: palabras.map(buildOR) };
}
