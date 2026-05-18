import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] pl-3.5 pr-9 py-2 text-sm',
          'focus-visible:outline-none focus-visible:border-[hsl(var(--brand-primary))]/60',
          'focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--brand-primary))]/15',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
    </div>
  ),
);
Select.displayName = 'Select';
