import PDFDocument from 'pdfkit';
import type { ReporteVentasDatos } from './reporte-ventas.service';

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  confirmada: 'Confirmada',
  pagada: 'Pagada',
  parcial: 'Parcial',
  anulada: 'Anulada',
};

const MEDIO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta_debito: 'T. débito',
  tarjeta_credito: 'T. crédito',
  transferencia: 'Transfer.',
  yape: 'Yape',
  plin: 'Plin',
  pix: 'PIX',
  otro: 'Otro',
};

/** Genera el reporte de ventas como PDF monoespaciado (fuente Courier). */
export function generarPdfVentas(d: ReporteVentasDatos): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 36;
    const W = doc.page.width - M * 2;
    const bottom = doc.page.height - M;
    let y = M;

    const text = (
      s: string,
      opts?: { bold?: boolean; size?: number; color?: string },
    ) => {
      const size = opts?.size ?? 8.5;
      if (y + size + 3 > bottom) { doc.addPage(); y = M; }
      doc
        .font(opts?.bold ? 'Courier-Bold' : 'Courier')
        .fontSize(size)
        .fillColor(opts?.color ?? '#111111')
        .text(s, M, y, { lineBreak: false, width: W + 4 });
      y += size + 3;
    };
    const gap = (h = 6) => { y += h; };
    const rule = () => {
      if (y + 4 > bottom) { doc.addPage(); y = M; }
      doc.moveTo(M, y).lineTo(M + W, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
      y += 5;
    };

    // ── Página 1: resumen ──────────────────────────────────────────────────
    text('REPORTE DE VENTAS', { bold: true, size: 16 });
    text(d.tenantNombre.toUpperCase(), { size: 10, color: '#444444' });
    text(`Periodo: ${d.periodo.etiqueta}`, { size: 9, color: '#444444' });
    text(`Generado: ${fechaHora(d.generadoEn)}    (montos en S/)`, { size: 8, color: '#777777' });
    gap();
    rule();

    const r = d.resumen;
    text('RESUMEN', { bold: true, size: 11 });
    gap(2);
    text(`Ventas (no anuladas) : ${r.cantidadVentas}`);
    text(`Anuladas             : ${r.cantidadAnuladas}`);
    text(`Subtotal             : ${money(r.subtotal)}`);
    text(`Descuentos           : ${money(r.descuentos)}`);
    text(`IGV / Impuestos      : ${money(r.impuestos)}`);
    text(`TOTAL                : ${money(r.total)}`, { bold: true });
    text(`Pagado               : ${money(r.totalPagado)}`);
    text(`Por cobrar           : ${money(r.porCobrar)}`);
    gap();

    text('RENTABILIDAD', { bold: true, size: 11 });
    gap(2);
    text(`Ingreso neto : ${money(r.rentabilidad.ingresoNeto)}`);
    text(`Costo total  : ${money(r.rentabilidad.costoTotal)}`);
    text(`Ganancia     : ${money(r.rentabilidad.ganancia)}`, { bold: true });
    text(
      `Margen       : ${pct(r.rentabilidad.margenPct)}   Markup: ${pct(r.rentabilidad.markupPct)}   ` +
        `(${r.rentabilidad.itemsConCosto}/${r.rentabilidad.itemsTotal} items con costo)`,
    );
    gap();

    // Desgloses
    if (r.porEstado.length) {
      text('POR ESTADO', { bold: true, size: 10 });
      for (const e of r.porEstado) {
        text(`  ${padR(ESTADO_LABEL[e.estado] ?? e.estado, 14)} ${String(e.cantidad).padStart(5)}   ${money(e.total).padStart(14)}`);
      }
      gap(4);
    }
    if (r.porMedioPago.length) {
      text('POR MEDIO DE PAGO', { bold: true, size: 10 });
      for (const m of r.porMedioPago) {
        text(`  ${padR(MEDIO_LABEL[m.medio] ?? m.medio, 14)} ${String(m.cantidad).padStart(5)}   ${money(m.monto).padStart(14)}`);
      }
      gap(4);
    }
    if (r.porSucursal.length > 1) {
      text('POR SUCURSAL', { bold: true, size: 10 });
      for (const s of r.porSucursal) {
        text(`  ${padR(s.sucursal, 20)} ${String(s.cantidad).padStart(5)}   ${money(s.total).padStart(14)}`);
      }
      gap(4);
    }
    if (d.truncado) {
      text(`NOTA: el reporte se limitó a las primeras ${d.ventas.length} ventas del período.`, { size: 8, color: '#a15c00' });
    }

    // ── Detalle de ventas ──────────────────────────────────────────────────
    doc.addPage(); y = M;
    const headVentas =
      `${'NUMERO'.padEnd(12)} ${'FECHA'.padEnd(8)} ${'CLIENTE'.padEnd(24)} ${'ITEMS'.padStart(5)} ` +
      `${'TOTAL'.padStart(13)} ${'ESTADO'.padEnd(10)} ${'MARGEN'.padStart(7)}`;
    tabla(
      'DETALLE DE VENTAS',
      headVentas,
      d.ventas.map(v =>
        `${padR(v.numero + (v.esNotaDeVenta ? '*' : ''), 12)} ${fecha(v.fecha).padEnd(8)} ${padR(v.cliente, 24)} ` +
        `${String(v.items).padStart(5)} ${num(v.total).padStart(13)} ${padR(ESTADO_LABEL[v.estado] ?? v.estado, 10)} ` +
        `${pct(v.margenPct).padStart(7)}`,
      ),
      d.ventas.length === 0 ? 'No hay ventas en el período.' : undefined,
    );
    if (d.ventas.some(v => v.esNotaDeVenta)) {
      gap(2);
      text('* Nota de venta interna (no se envía a SUNAT).', { size: 7.5, color: '#777777' });
    }

    // ── Ranking de productos ───────────────────────────────────────────────
    doc.addPage(); y = M;
    const headProd =
      `${'SKU'.padEnd(14)} ${'PRODUCTO'.padEnd(26)} ${'UNID'.padStart(6)} ${'INGRESO'.padStart(12)} ` +
      `${'COSTO'.padStart(12)} ${'GANANCIA'.padStart(12)} ${'MARGEN'.padStart(7)}`;
    tabla(
      'PRODUCTOS VENDIDOS (ranking por ingreso)',
      headProd,
      d.productos.map(p =>
        `${padR(p.sku, 14)} ${padR(p.nombre, 26)} ${String(p.unidades).padStart(6)} ${num(p.ingreso).padStart(12)} ` +
        `${(p.conCosto ? num(p.costo) : '—').padStart(12)} ${(p.conCosto ? num(p.ganancia) : '—').padStart(12)} ` +
        `${pct(p.margenPct).padStart(7)}`,
      ),
      d.productos.length === 0 ? 'No hay productos vendidos en el período.' : undefined,
    );

    // ── Pie de página: numeración ──────────────────────────────────────────
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc
        .font('Courier')
        .fontSize(7)
        .fillColor('#999999')
        .text(
          `${d.tenantNombre} · Reporte de ventas · ${d.periodo.etiqueta}`,
          M,
          doc.page.height - 26,
          { lineBreak: false, width: W },
        )
        .text(`Página ${i + 1} de ${rango.count}`, M, doc.page.height - 26, {
          lineBreak: false,
          width: W,
          align: 'right',
        });
    }

    doc.end();

    // ── helpers internos ─────────────────────────────────────────────────
    function tabla(titulo: string, headerLine: string, rows: string[], vacio?: string) {
      text(titulo, { bold: true, size: 11 });
      gap(1);
      const printHeader = () => { text(headerLine, { bold: true, size: 8 }); rule(); };
      printHeader();
      if (vacio) { text(vacio, { size: 8, color: '#777777' }); return; }
      for (const row of rows) {
        if (y + 11 > bottom) { doc.addPage(); y = M; printHeader(); }
        text(row, { size: 8 });
      }
    }
  });
}

// ── Formateadores (sin ICU para evitar diferencias de entorno) ───────────────
function num(n: number): string {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function money(n: number): string {
  return 'S/ ' + num(n);
}
function pct(p: number | null): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  return `${p >= 0 ? '+' : '-'}${Math.abs(Math.round(p))}%`;
}
function fecha(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function padR(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}
