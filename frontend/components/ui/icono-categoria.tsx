'use client';

import * as React from 'react';
import { Shirt, Footprints, Gem, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mapeo categoría → ícono temático. Algunos vienen de lucide-react (Shirt,
 * Footprints, Gem), otros son SVG inline (vestido, pantalón, falda, abrigo)
 * porque lucide no los incluye.
 *
 * Las prendas inline siguen el patrón de lucide: stroke 1.75, sin fill,
 * para combinar con los demás íconos del sistema.
 */

const Vestido = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Hombros y escote */}
    <path d="M8 3 L10 5 Q12 6 14 5 L16 3" />
    {/* Cintura ceñida y falda en A */}
    <path d="M8 3 L7 9 L5 21 L19 21 L17 9 L16 3" />
    <path d="M9 10 Q12 11 15 10" />
  </svg>
);

const Pantalon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Cintura */}
    <path d="M6 3 L18 3 L18 5 L6 5 Z" />
    {/* Ambas piernas */}
    <path d="M6 5 L7 21 L11 21 L12 11" />
    <path d="M18 5 L17 21 L13 21 L12 11" />
  </svg>
);

const Falda = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Cintura */}
    <path d="M7 5 L17 5 L18 7 L6 7 Z" />
    {/* Falda en A */}
    <path d="M6 7 L4 20 L20 20 L18 7" />
    {/* Pliegues */}
    <path d="M10 8 L9 19" />
    <path d="M14 8 L15 19" />
  </svg>
);

const Abrigo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Cuello solapas */}
    <path d="M9 3 L12 6 L15 3" />
    {/* Lados del abrigo */}
    <path d="M9 3 L5 7 L4 21 L11 21 L11 8" />
    <path d="M15 3 L19 7 L20 21 L13 21 L13 8" />
    {/* Botones */}
    <circle cx="12" cy="11" r="0.7" fill="currentColor" />
    <circle cx="12" cy="15" r="0.7" fill="currentColor" />
    <circle cx="12" cy="19" r="0.7" fill="currentColor" />
  </svg>
);

const MAPA: Record<string, React.ComponentType<{ className?: string }>> = {
  vestidos: Vestido,
  vestido: Vestido,
  camisas: Shirt,
  camisa: Shirt,
  polos: Shirt,
  polo: Shirt,
  blusas: Shirt,
  blusa: Shirt,
  pantalones: Pantalon,
  pantalon: Pantalon,
  jeans: Pantalon,
  faldas: Falda,
  falda: Falda,
  abrigos: Abrigo,
  abrigo: Abrigo,
  casacas: Abrigo,
  casaca: Abrigo,
  calzado: Footprints,
  calzados: Footprints,
  zapatos: Footprints,
  accesorios: Gem,
  accesorio: Gem,
};

interface Props {
  slug?: string | null;
  nombre?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

export function IconoCategoria({ slug, nombre, className, style }: Props) {
  const clave = (slug ?? nombre ?? '').toLowerCase().trim();
  const Icono = MAPA[clave] ?? Package;
  return (
    <span className={cn('inline-flex', className)} style={style}>
      <Icono className="size-full" />
    </span>
  );
}
