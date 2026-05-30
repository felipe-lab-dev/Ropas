'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { BarChart3, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { descargarArchivo, mensajeError } from '@/lib/api/client';

function primerDiaMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TITULOS: Record<string, string> = {
  ventas: 'Reporte de ventas',
  compras: 'Reporte de compras',
  inventario: 'Reporte de inventario',
  proveedores: 'Reporte de proveedores',
  clientes: 'Reporte de clientes',
  caja: 'Reporte de caja',
  productos: 'Reporte de productos',
  contabilidad: 'Reporte contable (libro diario)',
};

export type RecursoReporte =
  | 'ventas'
  | 'compras'
  | 'inventario'
  | 'proveedores'
  | 'clientes'
  | 'caja'
  | 'productos'
  | 'contabilidad';

/**
 * Botón "Reportes" reutilizable: abre un diálogo para descargar en Excel (.xlsx)
 * o PDF monoespaciado, respetando los filtros activos.
 *
 * @param recurso   Recurso a reportar; mapea a /reportes/{recurso}/{excel|pdf}.
 * @param filtros   Filtros activos extra (estado/estadoPago/sucursalId/buscar). Vacíos se omiten.
 * @param conRango  Si true (default) muestra selector de fechas desde/hasta. Para reportes
 *                  snapshot (inventario, proveedores) pasar false.
 */
export function ReportesBoton({
  recurso,
  filtros = {},
  conRango = true,
}: {
  recurso: RecursoReporte;
  filtros?: Record<string, string | undefined>;
  conRango?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [desde, setDesde] = React.useState(primerDiaMes);
  const [hasta, setHasta] = React.useState(hoyISO);
  const [cargando, setCargando] = React.useState<null | 'excel' | 'pdf'>(null);

  const filtrosActivos = Object.entries(filtros).filter(([, v]) => v != null && v !== '');

  const descargar = async (formato: 'excel' | 'pdf') => {
    if (cargando) return;
    setCargando(formato);
    try {
      const params: Record<string, string> = conRango ? { desde, hasta } : {};
      for (const [k, v] of filtrosActivos) params[k] = v as string;
      const ext = formato === 'excel' ? 'xlsx' : 'pdf';
      await descargarArchivo(`/reportes/${recurso}/${formato}`, params, `reporte-${recurso}-${desde}.${ext}`);
      toast.success(`Reporte ${formato === 'excel' ? 'Excel' : 'PDF'} generado`);
      setOpen(false);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setCargando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !cargando && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="lg" data-testid={`btn-reportes-${recurso}`}>
          <BarChart3 className="size-4" /> Reportes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TITULOS[recurso]}</DialogTitle>
          <DialogDescription>
            Elegí el período y descargá en Excel o PDF. El reporte respeta los filtros que
            tengas activos en el listado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {conRango && (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Desde</span>
                <Input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} aria-label="Fecha desde" />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">Hasta</span>
                <Input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} aria-label="Fecha hasta" />
              </label>
            </div>
          )}

          {filtrosActivos.length > 0 && (
            <p className="text-xs text-[hsl(var(--text-muted))]">
              Filtros aplicados:{' '}
              {filtrosActivos.map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={() => descargar('excel')} disabled={!!cargando} data-testid="btn-reporte-excel">
              {cargando === 'excel' ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              Excel
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => descargar('pdf')} disabled={!!cargando} data-testid="btn-reporte-pdf">
              {cargando === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
