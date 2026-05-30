'use client';

import {
  Users,
  Baby,
  Flower2,
  Leaf,
  Snowflake,
  Sparkles,
  FlaskConical,
  Layers,
  Footprints,
  Droplets,
} from 'lucide-react';
import type { OpcionIcono } from '@/components/ui/select-iconos';

/**
 * Catálogos de opciones con ícono para los formularios de producto.
 * Lucide no incluye símbolos de género (Venus/Mars) en esta versión, así que se
 * dibujan inline siguiendo el patrón de `icono-categoria.tsx` (stroke 1.75).
 */

const Venus = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="8" r="5" />
    <path d="M12 13v8M9 18h6" />
  </svg>
);

const Mars = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="10" cy="14" r="5" />
    <path d="M14.5 9.5 20 4M15 4h5v5" />
  </svg>
);

/** Géneros del producto (valores que espera el backend). */
export const GENEROS: OpcionIcono[] = [
  { valor: 'mujer', label: 'Mujer', icono: <Venus className="size-full" />, color: '#ec4899' },
  { valor: 'hombre', label: 'Hombre', icono: <Mars className="size-full" />, color: '#0ea5e9' },
  { valor: 'unisex', label: 'Unisex', icono: <Users className="size-full" />, color: '#8b5cf6' },
  { valor: 'ninia', label: 'Niña', icono: <Baby className="size-full" />, color: '#f472b6' },
  { valor: 'ninio', label: 'Niño', icono: <Baby className="size-full" />, color: '#38bdf8' },
];

/**
 * Materiales comunes de prendas. Es una lista de sugerencias: el combobox
 * permite escribir cualquier otro material (creatable).
 */
export const MATERIALES: OpcionIcono[] = [
  { valor: 'Algodón', label: 'Algodón', icono: <Flower2 className="size-full" />, color: '#22c55e' },
  { valor: 'Lino', label: 'Lino', icono: <Leaf className="size-full" />, color: '#84cc16' },
  { valor: 'Lana', label: 'Lana', icono: <Snowflake className="size-full" />, color: '#0ea5e9' },
  { valor: 'Seda', label: 'Seda', icono: <Sparkles className="size-full" />, color: '#a855f7' },
  { valor: 'Poliéster', label: 'Poliéster', icono: <FlaskConical className="size-full" />, color: '#f59e0b' },
  { valor: 'Denim', label: 'Denim', icono: <Layers className="size-full" />, color: '#3b82f6' },
  { valor: 'Cuero', label: 'Cuero', icono: <Footprints className="size-full" />, color: '#b45309' },
  { valor: 'Spandex', label: 'Spandex', icono: <Droplets className="size-full" />, color: '#06b6d4' },
];

/** Ícono genérico para un material custom no presente en `MATERIALES`. */
export const ICONO_MATERIAL_FALLBACK = <Layers className="size-full" />;

/**
 * Tallas sugeridas para los selectores de variante. Fuente única compartida por
 * el form de "Nuevo producto" y el mini-selector "Agregar variante" del buscador,
 * para que el usuario reconozca el mismo set de chips en ambos lados.
 */
export const TALLAS_SUGERIDAS: readonly string[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/**
 * Colores sugeridos (swatches) para los selectores de variante. Mismo criterio
 * de consistencia que `TALLAS_SUGERIDAS`: una sola fuente para todo el sistema.
 */
export const COLORES_SUGERIDOS: Array<{ nombre: string; hex: string }> = [
  { nombre: 'Negro', hex: '#111111' },
  { nombre: 'Blanco', hex: '#F8F8F8' },
  { nombre: 'Gris', hex: '#808080' },
  { nombre: 'Azul', hex: '#1E40AF' },
  { nombre: 'Rojo', hex: '#DC2626' },
  { nombre: 'Verde', hex: '#16A34A' },
  { nombre: 'Beige', hex: '#D4C5A0' },
  { nombre: 'Rosa', hex: '#EC4899' },
];
