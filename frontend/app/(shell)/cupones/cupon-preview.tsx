'use client';

import * as React from 'react';

interface Props {
  codigo: string;
  nombre: string;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: number;
  fechaFin: string | Date;
  montoMinimoCompra?: number | null;
  campania?: string | null;
  disenoColorPrimario: string;
  disenoColorSecundario: string;
  disenoMensaje?: string | null;
  disenoEmoji?: string | null;
  tienda?: string;
  compacto?: boolean;
}

/**
 * Preview visual del cupón en pantalla. Refleja exactamente el diseño que
 * genera el render del backend (PDF/PNG).
 */
export function CuponPreview({
  codigo,
  nombre,
  tipoDescuento,
  valorDescuento,
  fechaFin,
  montoMinimoCompra,
  campania,
  disenoColorPrimario,
  disenoColorSecundario,
  disenoMensaje,
  disenoEmoji,
  tienda = 'Mi Tienda',
  compacto = false,
}: Props) {
  const fin = typeof fechaFin === 'string' ? new Date(fechaFin) : fechaFin;
  const diasRestantes = Math.ceil(
    (fin.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const urgente = diasRestantes >= 0 && diasRestantes <= 7;
  const valorTxt =
    tipoDescuento === 'porcentaje'
      ? `${valorDescuento}%`
      : `S/ ${valorDescuento.toFixed(0)}`;

  return (
    <div
      data-testid="cupon-preview"
      className={`relative overflow-hidden rounded-2xl shadow-2xl ${compacto ? 'w-[300px] h-[180px]' : 'w-[420px] h-[260px]'} text-white`}
      style={{
        background: `linear-gradient(135deg, ${disenoColorPrimario} 0%, ${disenoColorSecundario} 100%)`,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Círculos decorativos */}
      <div
        className="absolute rounded-full"
        style={{
          width: compacto ? 120 : 180,
          height: compacto ? 120 : 180,
          right: compacto ? -30 : -40,
          top: compacto ? -30 : -40,
          background: 'rgba(255,255,255,0.06)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: compacto ? 90 : 130,
          height: compacto ? 90 : 130,
          left: compacto ? -20 : -30,
          bottom: compacto ? -20 : -30,
          background: 'rgba(255,255,255,0.06)',
        }}
      />

      <div className={`relative z-10 ${compacto ? 'p-4' : 'p-6'} flex flex-col h-full`}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className={`font-bold tracking-wide ${compacto ? 'text-xs' : 'text-sm'}`}>
              {tienda.toUpperCase()}
            </div>
            {campania && (
              <div className={`opacity-70 ${compacto ? 'text-[9px]' : 'text-[10px]'} mt-0.5`}>
                {campania.toUpperCase()}
              </div>
            )}
          </div>
          {disenoEmoji && (
            <div className={compacto ? 'text-2xl' : 'text-4xl'}>{disenoEmoji}</div>
          )}
        </div>

        {/* Hero value */}
        <div className={`mt-${compacto ? '1' : '2'} leading-none`}>
          <div className={`font-extrabold ${compacto ? 'text-5xl' : 'text-7xl'}`}>{valorTxt}</div>
          <div className={`font-bold ${compacto ? 'text-[10px] mt-1' : 'text-xs mt-1'}`}>
            DE DESCUENTO
          </div>
        </div>

        {/* Nombre + mensaje */}
        <div className="mt-auto">
          <div className={`font-semibold ${compacto ? 'text-sm' : 'text-base'} truncate`}>
            {nombre}
          </div>
          {disenoMensaje && (
            <div className={`italic opacity-80 ${compacto ? 'text-[10px]' : 'text-xs'} mt-0.5 line-clamp-1`}>
              {disenoMensaje}
            </div>
          )}
        </div>

        {/* Línea + código */}
        <div
          className={`mt-${compacto ? '2' : '3'} border-t border-dashed border-white/30 pt-${compacto ? '2' : '3'} flex items-end justify-between`}
        >
          <div>
            <div className={`font-mono font-extrabold tracking-wider ${compacto ? 'text-lg' : 'text-2xl'}`}>
              {codigo}
            </div>
            <div className={`opacity-70 ${compacto ? 'text-[9px]' : 'text-[10px]'} mt-1 space-x-2`}>
              <span>Vence: {fin.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</span>
              {montoMinimoCompra ? <span>· Mín: S/ {montoMinimoCompra.toFixed(2)}</span> : null}
            </div>
          </div>
          {/* Placeholder QR */}
          <div
            className={`${compacto ? 'w-12 h-12' : 'w-16 h-16'} grid place-items-center rounded bg-white/10 backdrop-blur-sm`}
            aria-hidden
          >
            <QrSimulado size={compacto ? 36 : 48} />
          </div>
        </div>

        {urgente && (
          <div
            className={`absolute ${compacto ? 'top-2 right-12 text-[9px]' : 'top-3 right-16 text-[11px]'} font-bold px-2 py-0.5 rounded`}
            style={{ background: '#fbbf24', color: '#451a03' }}
          >
            {diasRestantes <= 0
              ? 'VENCE HOY'
              : diasRestantes === 1
                ? 'VENCE MAÑANA'
                : `${diasRestantes}D RESTANTES`}
          </div>
        )}
      </div>
    </div>
  );
}

function QrSimulado({ size }: { size: number }) {
  const cells = 7;
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${cells}, 1fr)`, width: size, height: size, gap: 1 }}
    >
      {Array.from({ length: cells * cells }, (_, i) => {
        const x = i % cells;
        const y = Math.floor(i / cells);
        const corner =
          (x < 2 && y < 2) || (x > cells - 3 && y < 2) || (x < 2 && y > cells - 3);
        const random = Math.sin(i * 12.9898) * 43758.5453;
        const fill = corner || (random - Math.floor(random)) > 0.55;
        return (
          <div
            key={i}
            className="rounded-[1px]"
            style={{ background: fill ? '#fff' : 'transparent' }}
          />
        );
      })}
    </div>
  );
}
