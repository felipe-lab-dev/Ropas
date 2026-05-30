import PDFDocument from 'pdfkit';
import type { ReporteProveedoresDatos, FilaProveedorReporte } from './reporte-proveedores.service';

const CONDICION_LABEL: Record<string, string> = {
  contado: 'Contado',
  credito_15: 'Crédito 15d',
  credito_30: 'Crédito 30d',
  credito_60: 'Crédito 60d',
  credito_otro: 'Crédito otro',
};

/** Reporte de proveedores como PDF monoespaciado. Montos en S/. */
export function generarPdfProveedores(d: ReporteProveedoresDatos): Promise<Buffer> {
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

    text('REPORTE DE PROVEEDORES', { bold: true, size: 16 });
    text(d.tenantNombre.toUpperCase(), { size: 10, color: '#444444' });
    text(`Snapshot al: ${fechaHora(d.generadoEn)}    (montos en S/)`, { size: 8, color: '#777777' });
    gap();
    rule();

    const r = d.resumen;
    text('RESUMEN', { bold: true, size: 11 });
    gap(2);
    text(`Proveedores      : ${r.total}  (activos ${r.activos} / inactivos ${r.inactivos})`);
    text(`Total comprado   : ${money(r.totalComprado)}`, { bold: true });
    text(`Deuda actual     : ${money(r.deudaTotal)}`, { bold: true });
    text(`Con deuda        : ${r.conDeuda}`);
    gap();

    if (r.porCondicionPago.length) {
      text('POR CONDICIÓN DE PAGO', { bold: true, size: 10 });
      text(`  ${'CONDICIÓN'.padEnd(14)} ${'CANT'.padStart(5)} ${'COMPRADO'.padStart(14)} ${'DEUDA'.padStart(14)}`, { bold: true, size: 8 });
      for (const c of r.porCondicionPago) {
        text(`  ${padR(CONDICION_LABEL[c.condicion] ?? c.condicion, 14)} ${String(c.cantidad).padStart(5)} ${num(c.comprado).padStart(14)} ${num(c.deuda).padStart(14)}`);
      }
      gap(4);
    }
    if (d.truncado) {
      text(`NOTA: el reporte se limitó a los primeros ${d.proveedores.length} proveedores.`, { size: 8, color: '#a15c00' });
    }

    // Detalle de proveedores
    doc.addPage(); y = M;
    tabla('DETALLE DE PROVEEDORES', d.proveedores, d.proveedores.length === 0 ? 'Sin proveedores para los filtros.' : undefined);

    // Cuentas por pagar (ranking por deuda)
    doc.addPage(); y = M;
    tabla('MAYORES DEUDAS (cuentas por pagar)', d.deudas, d.deudas.length === 0 ? 'No hay deudas pendientes. 👍' : undefined);

    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc.font('Courier').fontSize(7).fillColor('#999999')
        .text(`${d.tenantNombre} · Reporte de proveedores`, M, doc.page.height - 26, { lineBreak: false, width: W })
        .text(`Página ${i + 1} de ${rango.count}`, M, doc.page.height - 26, { lineBreak: false, width: W, align: 'right' });
    }

    doc.end();

    function tabla(titulo: string, rows: FilaProveedorReporte[], vacio?: string) {
      text(titulo, { bold: true, size: 11 });
      gap(1);
      const header =
        `${'RAZÓN SOCIAL'.padEnd(28)} ${'DOCUMENTO'.padEnd(12)} ${'CONDICIÓN'.padEnd(12)} ` +
        `${'COMPRADO'.padStart(13)} ${'DEUDA'.padStart(13)} ${'EST'.padEnd(4)}`;
      const printHeader = () => { text(header, { bold: true, size: 8 }); rule(); };
      printHeader();
      if (vacio) { text(vacio, { size: 8, color: '#777777' }); return; }
      for (const p of rows) {
        if (y + 11 > bottom) { doc.addPage(); y = M; printHeader(); }
        text(
          `${padR(p.razonSocial, 28)} ${padR(p.documento, 12)} ${padR(CONDICION_LABEL[p.condicionPago] ?? p.condicionPago, 12)} ` +
          `${num(p.totalComprado).padStart(13)} ${num(p.deudaActual).padStart(13)} ${padR(p.activo ? 'Act' : 'Ina', 4)}`,
          { size: 8 },
        );
      }
    }
  });
}

function num(n: number): string { return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function money(n: number): string { return 'S/ ' + num(n); }
function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function padR(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n); }
