import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3.5 py-2 text-sm',
        'placeholder:text-[hsl(var(--text-muted))]',
        'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
        'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
