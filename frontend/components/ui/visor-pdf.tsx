'use client';

import * as React from 'react';
import { FileText, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { DetalleSheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { api, mensajeError } from '@/lib/api/client';

interface Props {
  /** Endpoint del API que devuelve el PDF (stream). Pasa por el interceptor (auth + tenant). */
  url: string;
  /** Nombre sugerido al descargar. */
  fileName?: string;
  /** Título del visor. */
  titulo?: string;
  /** Texto del botón disparador. Si se omite, el botón queda solo con ícono. */
  label?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
}

/**
 * Botón que abre un visor de PDF embebido dentro del sistema — no en una pestaña
 * nueva. Usa el `DetalleSheet` (drawer lateral en escritorio, bottom sheet en
 * móvil con safe-areas) para respetar el patrón PWA del proyecto: NO modales
 * centrados. Descarga el PDF como blob autenticado y lo renderiza en un
 * `<iframe>` con el visor nativo del navegador, con opción de descargar.
 */
export function BotonVisorPdf({
  url,
  fileName = 'documento.pdf',
  titulo = 'Comprobante',
  label,
  variant = 'outline',
  size = 'sm',
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [src, setSrc] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(false);

  const liberar = React.useCallback(() => {
    setSrc(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  // Libera el object URL al desmontar.
  React.useEffect(() => () => liberar(), [liberar]);

  const abrir = async () => {
    setOpen(true);
    setCargando(true);
    try {
      const { data } = await api.get<Blob>(url, { responseType: 'blob' });
      setSrc(URL.createObjectURL(data));
    } catch (err) {
      toast.error(mensajeError(err));
      setOpen(false);
    } finally {
      setCargando(false);
    }
  };

  const onOpenChange = (abierto: boolean) => {
    setOpen(abierto);
    if (!abierto) liberar();
  };

  const descargar = () => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = fileName;
    a.click();
  };

  return (
    <>
      <Button
        variant={variant}
        size={label ? size : 'icon-sm'}
        onClick={abrir}
        disabled={cargando}
        title="Ver PDF"
        aria-label={label ?? 'Ver PDF'}
      >
        {cargando && !open ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileText className="size-4" />
        )}
        {label}
      </Button>

      <DetalleSheet
        open={open}
        onOpenChange={onOpenChange}
        titulo={titulo}
        subtitulo="Vista previa del comprobante"
        icono={<FileText className="size-4" />}
        ancho="3xl"
        bodyClassName="p-0"
        footer={
          <Button variant="outline" size="sm" onClick={descargar} disabled={!src}>
            <Download className="size-4" /> Descargar
          </Button>
        }
      >
        <div className="grid h-full min-h-[70dvh] place-items-center bg-[hsl(var(--surface-2))]">
          {src ? (
            // Parámetros del visor PDF de Chrome: `navpanes=0` oculta el panel de
            // miniaturas y `view=FitH` ajusta el ancho de la página al visor.
            <iframe
              src={`${src}#toolbar=1&navpanes=0&view=FitH`}
              title={titulo}
              className="size-full border-0"
            />
          ) : (
            <Loader2 className="size-6 animate-spin text-[hsl(var(--text-muted))]" />
          )}
        </div>
      </DetalleSheet>
    </>
  );
}
