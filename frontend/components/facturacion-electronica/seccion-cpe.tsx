'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  FileText,
  RefreshCw,
  Send,
  FileCode,
  FileCheck2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EstadoCpeBadge } from './estado-cpe-badge';
import {
  useDocumentoElectronico,
  useEmitirCpe,
  useReintentarCpe,
  useConsultarEstadoCpe,
  esVistaCompleta,
  type OrigenCpe,
} from '@/lib/api/hooks/use-documento-electronico';
import { mensajeError } from '@/lib/api/client';
import { formatearFecha } from '@/lib/utils';
import { tienePermiso, useSesion } from '@/lib/store/sesion';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SeccionCpePropsLegacy {
  /** @deprecated Usar `origen` */
  ventaId: string;
  puedeEmitir: boolean;
  origen?: never;
}

interface SeccionCpePropsNueva {
  /** Origen del CPE: venta o nota de crédito. */
  origen: OrigenCpe;
  puedeEmitir: boolean;
  ventaId?: never;
}

type SeccionCpeProps = SeccionCpePropsLegacy | SeccionCpePropsNueva;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncarHash(hash: string | null): string {
  if (!hash) return '—';
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SeccionCpe(props: SeccionCpeProps) {
  const origen: OrigenCpe =
    'origen' in props && props.origen
      ? props.origen
      : { tipo: 'venta', id: (props as SeccionCpePropsLegacy).ventaId };
  const { puedeEmitir } = props;

  const permisos = useSesion((s) => s.usuario?.permisos);
  const esContabilidad = tienePermiso(permisos, 'contabilidad:leer');

  const { data: documento, isLoading } = useDocumentoElectronico(origen);

  const emitir = useEmitirCpe(origen);
  const reintentar = useReintentarCpe(origen);
  const consultarEstado = useConsultarEstadoCpe(origen);

  function handleEmitir() {
    emitir.mutate(undefined, {
      onSuccess: (doc) => {
        // Toast genérico para no-contabilidad: nunca exponer el estado SUNAT.
        if (esContabilidad && esVistaCompleta(doc)) {
          toast.success(`Comprobante emitido — estado: ${doc.estadoSunat}`);
        } else {
          toast.success('Comprobante enviado');
        }
      },
      onError: (err) => {
        if (esContabilidad) {
          toast.error(`No se pudo emitir el comprobante: ${mensajeError(err)}`);
        } else {
          toast.error('No se pudo emitir el comprobante. Contabilidad ya fue notificada.');
        }
      },
    });
  }

  function handleReintentar() {
    reintentar.mutate(undefined, {
      onSuccess: (doc) => {
        if (esContabilidad && esVistaCompleta(doc)) {
          toast.success(`Comprobante reenviado — estado: ${doc.estadoSunat}`);
        } else {
          toast.success('Comprobante reenviado');
        }
      },
      onError: (err) => {
        if (esContabilidad) {
          toast.error(`No se pudo reintentar: ${mensajeError(err)}`);
        } else {
          toast.error('No se pudo reenviar el comprobante.');
        }
      },
    });
  }

  function handleConsultarEstado() {
    consultarEstado.mutate(undefined, {
      onSuccess: (doc) => {
        if (esContabilidad && esVistaCompleta(doc)) {
          toast.success(`Estado actualizado: ${doc.estadoSunat}`);
        } else {
          toast.success('Estado actualizado');
        }
      },
      onError: (err) => {
        if (esContabilidad) {
          toast.error(`No se pudo consultar el estado: ${mensajeError(err)}`);
        } else {
          toast.error('No se pudo consultar el estado.');
        }
      },
    });
  }

  // ── Visibilidad: no-contabilidad sin documento → no renderizar nada ─────────
  // El backend ya filtró: si llega null y no es contabilidad, significa
  // que el CPE no está aceptado o no existe. Silencio total.
  if (!isLoading && !documento && !esContabilidad) {
    return null;
  }

  return (
    <Card className="overflow-hidden" data-testid="seccion-cpe">
      <div className="p-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <FileText className="size-4 text-[hsl(var(--text-muted))]" />
        <h2 className="font-semibold text-sm">Facturación Electrónica</h2>
      </div>

      <div className="p-4">
        {/* Cargando */}
        {isLoading && (
          <div className="space-y-3" data-testid="cpe-skeleton">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        )}

        {/* Sin documento — solo contabilidad ve este estado (ofrecer emisión) */}
        {!isLoading && !documento && esContabilidad && (
          <div className="space-y-3" data-testid="cpe-sin-documento">
            <p className="text-sm text-[hsl(var(--text-muted))]">
              Aún no se ha emitido el comprobante electrónico.
            </p>
            {puedeEmitir && (
              <Button
                size="sm"
                disabled={emitir.isPending}
                onClick={handleEmitir}
                data-testid="btn-emitir-cpe"
              >
                {emitir.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {emitir.isPending ? 'Emitiendo…' : 'Emitir comprobante'}
              </Button>
            )}
          </div>
        )}

        {/* Con documento + NO-contabilidad (vista reducida → solo PDF) */}
        {!isLoading && documento && !esVistaCompleta(documento) && (
          <div className="space-y-3" data-testid="cpe-vista-reducida">
            <p className="text-xs text-[hsl(var(--text-muted))]">
              Comprobante electrónico {documento.serie}-{documento.correlativo}
            </p>
            <a
              href={documento.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-pdf"
            >
              <Button variant="outline" size="sm">
                <FileText className="size-3.5" />
                Descargar PDF
                <ExternalLink className="size-3" />
              </Button>
            </a>
          </div>
        )}

        {/* Con documento + CONTABILIDAD (vista completa) */}
        {!isLoading && documento && esVistaCompleta(documento) && (
          <div className="space-y-3" data-testid="cpe-con-documento">
            <div className="flex items-center gap-3 flex-wrap">
              <EstadoCpeBadge estado={documento.estadoSunat} />
              <span className="font-mono text-sm font-semibold tracking-wide text-[hsl(var(--text-muted))]">
                {documento.serie}-{documento.correlativo}
              </span>
            </div>

            {documento.ultimoErrorTexto &&
              (documento.estadoSunat === 'pendiente' || documento.estadoSunat === 'rechazado') && (
                <p className="text-xs text-[hsl(var(--brand-danger,355_75%_60%))] bg-red-500/10 rounded px-2 py-1.5 font-mono break-all">
                  {documento.ultimoErrorTexto}
                </p>
              )}

            {documento.mensajeSunat && documento.estadoSunat === 'aceptado_observado' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
                {documento.mensajeSunat}
              </p>
            )}

            {documento.codigoHash && (
              <div className="text-xs text-[hsl(var(--text-muted))] space-y-0.5">
                <span className="font-mono">
                  Hash:{' '}
                  <span title={documento.codigoHash ?? undefined}>
                    {truncarHash(documento.codigoHash)}
                  </span>
                </span>
              </div>
            )}
            {documento.enviadoEn && (
              <p className="text-xs text-[hsl(var(--text-muted))]">
                Enviado: {formatearFecha(documento.enviadoEn, 'completa')}
              </p>
            )}
            {documento.aceptadoEn && (
              <p className="text-xs text-[hsl(var(--text-muted))]">
                Aceptado: {formatearFecha(documento.aceptadoEn, 'completa')}
              </p>
            )}

            {documento.cadenaQr && (
              <details className="text-xs text-[hsl(var(--text-muted))]">
                <summary className="cursor-pointer select-none hover:text-[hsl(var(--text-default))]">
                  Cadena QR
                </summary>
                <p className="mt-1 font-mono break-all bg-[hsl(var(--surface-2))] rounded p-2 text-[10px] select-all">
                  {documento.cadenaQr}
                </p>
              </details>
            )}

            {/* Links PDF / XML / CDR */}
            {(documento.pdfUrl || documento.xmlEnviadoUrl || documento.cdrUrl) && (
              <div className="flex flex-wrap gap-2 pt-1" data-testid="cpe-links">
                {documento.pdfUrl && (
                  <a href={documento.pdfUrl} target="_blank" rel="noopener noreferrer" data-testid="link-pdf">
                    <Button variant="outline" size="sm">
                      <FileText className="size-3.5" />
                      PDF
                      <ExternalLink className="size-3" />
                    </Button>
                  </a>
                )}
                {documento.xmlEnviadoUrl && (
                  <a href={documento.xmlEnviadoUrl} target="_blank" rel="noopener noreferrer" data-testid="link-xml">
                    <Button variant="outline" size="sm">
                      <FileCode className="size-3.5" />
                      XML
                      <ExternalLink className="size-3" />
                    </Button>
                  </a>
                )}
                {documento.cdrUrl && (
                  <a href={documento.cdrUrl} target="_blank" rel="noopener noreferrer" data-testid="link-cdr">
                    <Button variant="outline" size="sm">
                      <FileCheck2 className="size-3.5" />
                      CDR
                      <ExternalLink className="size-3" />
                    </Button>
                  </a>
                )}
              </div>
            )}

            {/* Acciones según estado */}
            <div className="flex flex-wrap gap-2 pt-1">
              {(documento.estadoSunat === 'pendiente' || documento.estadoSunat === 'rechazado') &&
                puedeEmitir && (
                  <Button
                    size="sm"
                    disabled={reintentar.isPending}
                    onClick={handleReintentar}
                    data-testid="btn-reintentar-cpe"
                  >
                    {reintentar.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    {reintentar.isPending ? 'Reintentando…' : 'Reintentar'}
                  </Button>
                )}

              {documento.estadoSunat === 'en_proceso' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={consultarEstado.isPending}
                  onClick={handleConsultarEstado}
                  data-testid="btn-consultar-estado"
                >
                  {consultarEstado.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  {consultarEstado.isPending ? 'Consultando…' : 'Consultar estado SUNAT'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
