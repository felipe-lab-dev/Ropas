'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-[hsl(var(--brand-primary))] text-white shadow-md hover:bg-[hsl(var(--brand-primary-hover))] hover:shadow-[var(--shadow-glow)]',
        secondary:
          'bg-[hsl(var(--surface-2))] text-[hsl(var(--text))] hover:bg-[hsl(var(--surface-2))]/80 border border-[hsl(var(--border))]',
        outline:
          'border border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--surface))] hover:border-[hsl(var(--brand-primary))]/40',
        ghost:
          'hover:bg-[hsl(var(--surface))] text-[hsl(var(--text))]',
        danger:
          'bg-[hsl(var(--brand-danger))] text-white shadow-md hover:bg-[hsl(var(--brand-danger))]/90',
        link: 'text-[hsl(var(--brand-primary))] underline-offset-4 hover:underline',
        accent:
          'bg-[hsl(var(--brand-accent))] text-black font-semibold shadow-md hover:brightness-110',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6 text-base',
        xl: 'h-14 rounded-xl px-8 text-lg',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
