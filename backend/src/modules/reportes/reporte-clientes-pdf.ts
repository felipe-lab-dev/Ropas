import PDFDocument from 'pdfkit';
import type { ReporteClientesDatos, FilaClienteReporte } from './reporte-clientes.service';

const CLASE_LABEL: Record<string, string> = {
  AA: 'AA · VIP', A: 'A · Top', B: 'B · Sólidos', C: 'C · Ocasionales', D: 'D · Fríos',
  'Sin clasificar': 'Sin clasificar',
};

/** Reporte de clientes como PDF monoespaciado. Montos en S/. */
export function generarPdfClientes(d: ReporteClientesDatos): Promise<Buffer> {
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

    text('REPORTE DE CLIENTES', { bold: true, size: 16 });
    text(d.tenantNombre.toUpperCase(), { size: 10, color: '#444444' });
    text(`Snapshot al: ${fechaHora(d.generadoEn)}    (montos en S/)`, { size: 8, color: '#777777' });
    gap();
    rule();

    const r = d.resumen;
    text('RESUMEN', { bold: true, size: 11 });
    gap(2);
    text(`Clientes         : ${r.total}  (con compras ${r.conCompras} / sin compras ${r.sinCompras})`);
    text(`Total comprado   : ${money(r.totalCompras)}`, { bold: true });
    text(`Ticket promedio  : ${money(r.ticketPromedio)}  (por cliente con compras)`);
    gap();

    if (r.porClasificacion.length) {
      text('POR CLASIFICACIÓN (RFM)', { bold: true, size: 10 });
      text(`  ${'CLASE'.padEnd(18)} ${'CANT'.padStart(5)} ${'COMPRAS'.padStart(14)}`, { bold: true, size: 8 });
      for (const c of r.porClasificacion) {
        text(`  ${padR(CLASE_LABEL[c.clasificacion] ?? c.clasificacion, 18)} ${String(c.cantidad).padStart(5)} ${num(c.compras).padStart(14)}`);
      }
      gap(4);
    }
    if (d.truncado) {
      text(`NOTA: el reporte se limitó a los primeros ${d.clientes.length} clientes.`, { size: 8, color: '#a15c00' });
    }

    doc.addPage(); y = M;
    tabla('DETALLE DE CLIENTES', d.clientes, d.clientes.length === 0 ? 'Sin clientes para los filtros.' : undefined);

    doc.addPage(); y = M;
    tabla('TOP 20 COMPRADORES', d.top, d.top.length === 0 ? 'Sin clientes con compras.' : undefined);

    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc.font('Courier').fontSize(7).fillColor('#999999')
        .text(`${d.tenantNombre} · Reporte de clientes`, M, doc.page.height - 26, { lineBreak: false, width: W })
        .text(`Página ${i + 1} de ${rango.count}`, M, doc.page.height - 26, { lineBreak: false, width: W, align: 'right' });
    }

    doc.end();

    function tabla(titulo: string, rows: FilaClienteReporte[], vacio?: string) {
      text(titulo, { bold: true, size: 11 });
      gap(1);
      const header =
        `${'CÓDIGO'.padEnd(9)} ${'NOMBRE'.padEnd(28)} ${'DOCUMENTO'.padEnd(12)} ${'CLASE'.padEnd(6)} ` +
        `${'COMPRADO'.padStart(13)} ${'ÚLT.COMPRA'.padEnd(10)}`;
      const printHeader = () => { text(header, { bold: true, size: 8 }); rule(); };
      printHeader();
      if (vacio) { text(vacio, { size: 8, color: '#777777' }); return; }
      for (const c of rows) {
        if (y + 11 > bottom) { doc.addPage(); y = M; printHeader(); }
        text(
          `${padR(c.codigo, 9)} ${padR(c.nombre, 28)} ${padR(c.documento, 12)} ${padR(c.clasificacion, 6)} ` +
          `${num(c.totalCompras).padStart(13)} ${(c.ultimaCompraEn ? fecha(c.ultimaCompraEn) : '—').padEnd(10)}`,
          { size: 8 },
        );
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
