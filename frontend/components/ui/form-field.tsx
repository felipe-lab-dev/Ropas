'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { RequiredMark } from '@/components/ui/required-mark';
import { FieldError } from '@/components/ui/field-error';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  /** Texto visible del label */
  label: React.ReactNode;
  /** id del input asociado para el htmlFor del label */
  htmlFor?: string;
  /** marca el campo como obligatorio (asterisco rojo) */
  requerido?: boolean;
  /** mensaje de error inline. Si está presente, agrega borde rojo al wrapper. */
  error?: string | null;
  /** texto auxiliar mostrado debajo cuando no hay error */
  hint?: React.ReactNode;
  /** className extra para el contenedor */
  className?: string;
  /** className extra para el label */
  labelClassName?: string;
  children: React.ReactNode;
}

/**
 * Wrapper estándar para campos de formulario.
 *
 * Cumple con la regla universal de UI (CLAUDE.md):
 *  - Asterisco rojo automático cuando `requerido`.
 *  - Mensaje de error en rojo debajo del campo cuando `error`.
 *  - `aria-invalid` y `aria-describedby` propagados vía data-attributes
 *    para que el input lo lea si lo respeta.
 *
 * Uso:
 *   <FormField label="Nombre" htmlFor="nombre" requerido error={errores.nombre}>
 *     <Input id="nombre" ... />
 *   </FormField>
 */
export function FormField({
  label,
  htmlFor,
  requerido,
  error,
  hint,
  className,
  labelClassName,
  children,
}: FormFieldProps) {
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn('space-y-1', className)} data-field-error={error ? 'true' : undefined}>
      <Label htmlFor={htmlFor} className={cn('flex items-center', labelClassName)}>
        <span>{label}</span>
        {requerido && <RequiredMark />}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            'aria-invalid': error ? true : undefined,
            'aria-describedby': errorId,
          })
        : children}
      {error ? (
        <FieldError mensaje={error} id={errorId} />
      ) : hint ? (
        <p className="mt-1 text-xs text-[hsl(var(--text-muted))]">{hint}</p>
      ) : null}
    </div>
  );
}
