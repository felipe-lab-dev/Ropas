'use client';

import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mensajeError } from '@/lib/api/client';

interface EstadoErrorProps {
  /** Título del error. Default genérico; pásale algo específico ("No se pudieron cargar las ventas"). */
  titulo?: string;
  /** El error de React Query / axios. Se formatea con mensajeError(). */
  error?: unknown;
  /** Callback de reintento (típicamente refetch de useQuery). Si no se pasa, no se muestra el botón. */
  onReintentar?: () => void;
  /** True mientras reintenta (isFetching), deshabilita el botón. */
  reintentando?: boolean;
  className?: string;
}

/**
 * Card de error estándar para fallos de carga de datos (useQuery isError).
 * Evita el "loading infinito" cuando la API no responde: comunica el fallo
 * y ofrece reintentar. Mismo look que el patrón inline de clientes/productos.
 */
export function EstadoError({
  titulo = 'No se pudieron cargar los datos',
  error,
  onReintentar,
  reintentando,
  className,
}: EstadoErrorProps) {
  return (
    <Card className={`p-4 border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)] ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="size-5 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[hsl(355_75%_85%)]">{titulo}</div>
          <div className="text-sm text-[hsl(355_75%_75%)] mt-1 break-words">{mensajeError(error)}</div>
        </div>
        {onReintentar && (
          <Button size="sm" variant="outline" onClick={onReintentar} disabled={reintentando}>
            Reintentar
          </Button>
        )}
      </div>
    </Card>
  );
}
