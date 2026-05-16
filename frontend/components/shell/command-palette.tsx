'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Wallet,
  Users, BarChart3, Settings, Building2, Plus, ArrowRight,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();

  const ir = (ruta: string) => {
    onOpenChange(false);
    router.push(ruta);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar módulo, acción, producto…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Acciones rápidas">
          <CommandItem onSelect={() => ir('/pos')}>
            <ShoppingCart /> Nueva venta (POS) <span className="ml-auto text-[10px] text-[hsl(var(--text-muted))]">N V</span>
          </CommandItem>
          <CommandItem onSelect={() => ir('/productos/nuevo')}>
            <Plus /> Nuevo producto
          </CommandItem>
          <CommandItem onSelect={() => ir('/clientes/nuevo')}>
            <Plus /> Nuevo cliente
          </CommandItem>
          <CommandItem onSelect={() => ir('/caja')}>
            <Wallet /> Abrir / cerrar caja
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegación">
          <CommandItem onSelect={() => ir('/dashboard')}>
            <LayoutDashboard /> Dashboard <ArrowRight className="ml-auto opacity-50" />
          </CommandItem>
          <CommandItem onSelect={() => ir('/productos')}>
            <Package /> Productos
          </CommandItem>
          <CommandItem onSelect={() => ir('/inventario')}>
            <Boxes /> Inventario
          </CommandItem>
          <CommandItem onSelect={() => ir('/ventas')}>
            <ShoppingCart /> Ventas
          </CommandItem>
          <CommandItem onSelect={() => ir('/clientes')}>
            <Users /> Clientes
          </CommandItem>
          <CommandItem onSelect={() => ir('/sucursales')}>
            <Building2 /> Sucursales
          </CommandItem>
          <CommandItem onSelect={() => ir('/reportes')}>
            <BarChart3 /> Reportes
          </CommandItem>
          <CommandItem onSelect={() => ir('/configuracion')}>
            <Settings /> Configuración
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
