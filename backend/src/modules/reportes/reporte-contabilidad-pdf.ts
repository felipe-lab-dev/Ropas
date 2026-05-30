import PDFDocument from 'pdfkit';
import type { ReporteContabilidadDatos, FilaAsientoReporte, FilaCuentaReporte } from './reporte-contabilidad.service';

const TIPO_LABEL: Record<string, string> = {
  asiento_manual: 'Manual',
  venta: 'Venta',
  compra: 'Compra',
  pago_compra: 'Pago compra',
  cobro_venta: 'Cobro venta',
  nota_credito: 'Nota crédito',
  ajuste: 'Ajuste',
  apertura: 'Apertura',
  cierre: 'Cierre',
};

/** Reporte de contabilidad (libro diario) como PDF monoespaciado. Montos en S/. */
export function generarPdfContabilidad(d: ReporteContabilidadDatos): Promise<Buffer> {
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
      doc.font(opts?.bold ? 'Courier-Bold' : 'Courier').fontSize(size).fillColor(opts?.color ?? '#111111')
        .text(s, M, y, { lineBreak: false, width: W + 4 });
      y += size + 3;
    };
    const gap = (h = 6) => { y += h; };
    const rule = () => {
      if (y + 4 > bottom) { doc.addPage(); y = M; }
      doc.moveTo(M, y).lineTo(M + W, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
      y += 5;
    };

    text('REPORTE CONTABLE — LIBRO DIARIO', { bold: true, size: 15 });
    text(d.tenantNombre.toUpperCase(), { size: 10, color: '#444444' });
    text(`Periodo: ${d.periodo.etiqueta}`, { size: 9, color: '#444444' });
    text(`Generado: ${fechaHora(d.generadoEn)}    (montos en S/)`, { size: 8, color: '#777777' });
    gap();
    rule();

    const r = d.resumen;
    text('RESUMEN', { bold: true, size: 11 });
    gap(2);
    text(`Asientos     : ${r.asientos}`);
    text(`Total debe   : ${money(r.totalDebe)}`, { bold: true });
    text(`Total haber  : ${money(r.totalHaber)}`, { bold: true });
    text(`Descuadre    : ${money(r.descuadre)}`, { color: Math.abs(r.descuadre) > 0.01 ? '#c0392b' : '#777777' });
    gap();

    if (r.porTipoOperacion.length) {
      text('POR TIPO DE OPERACIÓN', { bold: true, size: 10 });
      text(`  ${'TIPO'.padEnd(16)} ${'CANT'.padStart(5)} ${'DEBE'.padStart(14)}`, { bold: true, size: 8 });
      for (const t of r.porTipoOperacion) {
        text(`  ${padR(TIPO_LABEL[t.tipo] ?? t.tipo, 16)} ${String(t.cantidad).padStart(5)} ${num(t.debe).padStart(14)}`);
      }
      gap(4);
    }
    if (d.truncado) text(`NOTA: el reporte se truncó por volumen (tope alcanzado).`, { size: 8, color: '#a15c00' });

    // Asientos (cabecera)
    doc.addPage(); y = M;
    text('ASIENTOS DEL PERÍODO', { bold: true, size: 11 });
    gap(1);
    const headA = `${'NÚMERO'.padEnd(16)} ${'FECHA'.padEnd(8)} ${'GLOSA'.padEnd(30)} ${'DEBE'.padStart(13)} ${'HABER'.padStart(13)}`;
    tabla(headA, d.asientos.map(a =>
      `${padR(a.numero, 16)} ${fecha(a.fecha).padEnd(8)} ${padR(a.glosa, 30)} ${num(a.debe).padStart(13)} ${num(a.haber).padStart(13)}`,
    ), d.asientos.length === 0 ? 'Sin asientos en el período.' : undefined);

    // Balance por cuenta
    doc.addPage(); y = M;
    text('SUMAS POR CUENTA (balance de comprobación)', { bold: true, size: 11 });
    gap(1);
    const headC = `${'CUENTA'.padEnd(12)} ${'NOMBRE'.padEnd(34)} ${'DEBE'.padStart(14)} ${'HABER'.padStart(14)}`;
    tabla(headC, d.porCuenta.map((c: FilaCuentaReporte) =>
      `${padR(c.codigo, 12)} ${padR(c.nombre, 34)} ${num(c.debe).padStart(14)} ${num(c.haber).padStart(14)}`,
    ), d.porCuenta.length === 0 ? 'Sin movimientos por cuenta.' : undefined);

    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc.font('Courier').fontSize(7).fillColor('#999999')
        .text(`${d.tenantNombre} · Libro diario · ${d.periodo.etiqueta}`, M, doc.page.height - 26, { lineBreak: false, width: W })
        .text(`Página ${i + 1} de ${rango.count}`, M, doc.page.height - 26, { lineBreak: false, width: W, align: 'right' });
    }

    doc.end();

    function tabla(header: string, rows: string[], vacio?: string) {
      const printHeader = () => { text(header, { bold: true, size: 8 }); rule(); };
      printHeader();
      if (vacio) { text(vacio, { size: 8, color: '#777777' }); return; }
      for (const row of rows) {
        if (y + 11 > bottom) { doc.addPage(); y = M; printHeader(); }
        text(row, { size: 8 });
      }
    }
  });
}

function num(n: number): string { return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function money(n: number): string { return 'S/ ' + num(n); }
function fecha(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function padR(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n); }
