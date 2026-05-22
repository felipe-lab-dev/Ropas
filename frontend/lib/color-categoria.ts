/**
 * Hash estable del slug de categoría a un color de la paleta.
 * Devuelve el color base + una variante suave para fondos.
 */
const PALETA: Array<{ base: string; suave: string }> = [
  { base: '#ec4899', suave: '#fce7f3' }, // rosa
  { base: '#8b5cf6', suave: '#ede9fe' }, // violeta (brand)
  { base: '#0ea5e9', suave: '#e0f2fe' }, // celeste
  { base: '#22c55e', suave: '#dcfce7' }, // verde
  { base: '#f59e0b', suave: '#fef3c7' }, // ambar
  { base: '#ef4444', suave: '#fee2e2' }, // rojo
  { base: '#14b8a6', suave: '#ccfbf1' }, // teal
  { base: '#6366f1', suave: '#e0e7ff' }, // indigo
  { base: '#d97706', suave: '#fef3c7' }, // naranja
  { base: '#84cc16', suave: '#ecfccb' }, // lima
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function colorCategoria(slug: string | undefined | null): { base: string; suave: string } {
  if (!slug) return PALETA[1]!; // default violeta brand
  return PALETA[hash(slug) % PALETA.length]!;
}
