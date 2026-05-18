import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3.5 py-2.5 text-sm',
        'placeholder:text-[hsl(var(--text-muted))]',
        'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
        'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all resize-y',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
