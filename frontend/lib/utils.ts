import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatearMoneda(valor: number | string, moneda = 'PEN'): string {
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatearNumero(valor: number, decimales = 0): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

export function formatearFecha(fecha: string | Date, formato: 'corta' | 'completa' = 'corta'): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (formato === 'completa') {
    return d.toLocaleString('es', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}
