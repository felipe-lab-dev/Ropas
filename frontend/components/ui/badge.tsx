import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[hsl(var(--brand-primary))]/15 text-[hsl(var(--brand-primary))]',
        accent: 'border-transparent bg-[hsl(var(--brand-accent))]/20 text-[hsl(var(--brand-accent))]',
        success: 'border-transparent bg-[hsl(var(--brand-success))]/15 text-[hsl(var(--brand-success))]',
        warning: 'border-transparent bg-[hsl(var(--brand-warning))]/15 text-[hsl(var(--brand-warning))]',
        danger: 'border-transparent bg-[hsl(var(--brand-danger))]/15 text-[hsl(var(--brand-danger))]',
        outline: 'border-[hsl(var(--border))] text-[hsl(var(--text-muted))]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
