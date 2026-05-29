import PDFDocument from 'pdfkit';
import type { ReporteComprasDatos } from './reporte-compras.service';

const ESTADO_PAGO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagada: 'Pagada',
  vencida: 'Vencida',
};

const TIPO_LABEL: Record<string, string> = {
  factura: 'Factura',
  boleta: 'Boleta',
  nota_ingreso: 'Nota ingreso',
  guia_remision: 'Guía remisión',
  recibo_honorarios: 'R. honorarios',
};

/** Reporte de compras como PDF monoespaciado (fuente Courier). Montos en S/. */
export function generarPdfCompras(d: ReporteComprasDatos): Promise<Buffer> {
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

    const text = (s: string, opts?: { bold?: boolean; size?: number; color?: string }) => {
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
    text('REPORTE DE COMPRAS', { bold: true, size: 16 });
    text(d.tenantNombre.toUpperCase(), { size: 10, color: '#444444' });
    text(`Periodo: ${d.periodo.etiqueta}`, { size: 9, color: '#444444' });
    text(`Generado: ${fechaHora(d.generadoEn)}    (montos en S/, multimoneda convertida a S/)`, { size: 8, color: '#777777' });
    gap();
    rule();

    const r = d.resumen;
    text('RESUMEN', { bold: true, size: 11 });
    gap(2);
    text(`Compras (no anuladas) : ${r.cantidadCompras}`);
    text(`Anuladas              : ${r.cantidadAnuladas}`);
    text(`Subtotal              : ${money(r.subtotal)}`);
    text(`Descuentos            : ${money(r.descuento)}`);
    text(`IGV                   : ${money(r.igv)}`);
    text(`Otros impuestos       : ${money(r.otros)}`);
    text(`TOTAL                 : ${money(r.total)}`, { bold: true });
    text(`Pagado                : ${money(r.totalPagado)}`);
    text(`Por pagar             : ${money(r.porPagar)}`);
    gap();

    bloque('POR ESTADO DE PAGO', r.porEstadoPago.map(e => [ESTADO_PAGO_LABEL[e.estadoPago] ?? e.estadoPago, e.cantidad, e.total]));
    bloque('POR PROVEEDOR (top 10)', r.porProveedor.slice(0, 10).map(p => [p.proveedor, p.cantidad, p.total]), 26);
    if (r.porSucursal.length > 1) {
      bloque('POR SUCURSAL', r.porSucursal.map(s => [s.sucursal, s.cantidad, s.total]), 20);
    }
    bloque('POR TIPO DE COMPROBANTE', r.porTipoComprobante.map(t => [TIPO_LABEL[t.tipo] ?? t.tipo, t.cantidad, t.total]), 16);

    if (d.truncado) {
      text(`NOTA: el reporte se limitó a las primeras ${d.compras.length} compras del período.`, { size: 8, color: '#a15c00' });
    }

    // ── Detalle de compras ─────────────────────────────────────────────────
    doc.addPage(); y = M;
    const headCompras =
      `${'NUMERO'.padEnd(13)} ${'FECHA'.padEnd(8)} ${'COMPROB.'.padEnd(13)} ${'PROVEEDOR'.padEnd(22)} ` +
      `${'TOTAL S/'.padStart(13)} ${'MON'.padEnd(3)} ${'PAGO'.padEnd(10)}`;
    tabla(
      'DETALLE DE COMPRAS',
      headCompras,
      d.compras.map(c =>
        `${padR(c.numero, 13)} ${fecha(c.fecha).padEnd(8)} ${padR(c.comprobante, 13)} ${padR(c.proveedor, 22)} ` +
        `${num(c.totalPen).padStart(13)} ${padR(c.moneda, 3)} ${padR(c.estado === 'anulada' ? 'Anulada' : (ESTADO_PAGO_LABEL[c.estadoPago] ?? c.estadoPago), 10)}`,
      ),
      d.compras.length === 0 ? 'No hay compras en el período.' : undefined,
    );

    // ── Productos comprados ────────────────────────────────────────────────
    doc.addPage(); y = M;
    const headProd =
      `${'SKU'.padEnd(16)} ${'PRODUCTO'.padEnd(34)} ${'UNID'.padStart(7)} ${'COSTO S/'.padStart(14)} ${'COMPRAS'.padStart(8)}`;
    tabla(
      'PRODUCTOS COMPRADOS (ranking por costo)',
      headProd,
      d.productos.map(p =>
        `${padR(p.sku, 16)} ${padR(p.nombre, 34)} ${String(p.unidades).padStart(7)} ${num(p.costoTotal).padStart(14)} ${String(p.compras).padStart(8)}`,
      ),
      d.productos.length === 0 ? 'No hay productos comprados en el período.' : undefined,
    );

    // ── Pie con numeración ─────────────────────────────────────────────────
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc
        .font('Courier').fontSize(7).fillColor('#999999')
        .text(`${d.tenantNombre} · Reporte de compras · ${d.periodo.etiqueta}`, M, doc.page.height - 26, { lineBreak: false, width: W })
        .text(`Página ${i + 1} de ${rango.count}`, M, doc.page.height - 26, { lineBreak: false, width: W, align: 'right' });
    }

    doc.end();

    function bloque(titulo: string, filas: Array<(string | number)[]>, anchoLabel = 14) {
      if (!filas.length) return;
      text(titulo, { bold: true, size: 10 });
      for (const f of filas) {
        text(`  ${padR(String(f[0]), anchoLabel)} ${String(f[1]).padStart(5)}   ${money(Number(f[2])).padStart(14)}`);
      }
      gap(4);
    }

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

function num(n: number): string {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function money(n: number): string {
  return 'S/ ' + num(n);
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
