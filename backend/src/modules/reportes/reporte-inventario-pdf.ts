import PDFDocument from 'pdfkit';
import type { ReporteInventarioDatos, FilaStockReporte } from './reporte-inventario.service';

const ESTADO_LABEL: Record<string, string> = { ok: 'OK', bajo: 'Bajo', agotado: 'Agotado' };

/** Reporte de inventario (snapshot) como PDF monoespaciado. Montos en S/. */
export function generarPdfInventario(d: ReporteInventarioDatos): Promise<Buffer> {
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

    text('REPORTE DE INVENTARIO', { bold: true, size: 16 });
    text(d.tenantNombre.toUpperCase(), { size: 10, color: '#444444' });
    text(`Snapshot al: ${fechaHora(d.generadoEn)}    (montos en S/)`, { size: 8, color: '#777777' });
    gap();
    rule();

    const r = d.resumen;
    text('RESUMEN', { bold: true, size: 11 });
    gap(2);
    text(`Registros de stock   : ${r.registros}`);
    text(`Unidades disponibles : ${r.unidadesDisponibles}`);
    text(`Reservado            : ${r.reservado}`);
    text(`Dañado               : ${r.danado}`);
    text(`Valor a costo        : ${money(r.valorCosto)}`, { bold: true });
    text(`Valor a venta        : ${money(r.valorVenta)}`);
    text(`Margen potencial     : ${money(r.margenPotencial)}`);
    text(`Alertas (stock bajo) : ${r.alertasBajo}`);
    text(`Agotados             : ${r.agotados}`);
    gap();

    bloque('POR SUCURSAL', r.porSucursal.map(s => [s.sucursal, s.unidades, s.valorCosto]), 20);
    bloque('POR CATEGORÍA', r.porCategoria.slice(0, 15).map(c => [c.categoria, c.unidades, c.valorCosto]), 22);

    if (d.truncado) {
      text(`NOTA: el reporte se limitó a las primeras ${d.stock.length} líneas de stock.`, { size: 8, color: '#a15c00' });
    }

    // Detalle de stock
    doc.addPage(); y = M;
    tablaStock('DETALLE DE STOCK', d.stock, d.stock.length === 0 ? 'Sin stock para los filtros.' : undefined);

    // Alertas
    doc.addPage(); y = M;
    tablaStock('ALERTAS DE STOCK (bajo / agotado)', d.alertas, d.alertas.length === 0 ? 'Sin alertas de stock. 👍' : undefined);

    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc.font('Courier').fontSize(7).fillColor('#999999')
        .text(`${d.tenantNombre} · Reporte de inventario`, M, doc.page.height - 26, { lineBreak: false, width: W })
        .text(`Página ${i + 1} de ${rango.count}`, M, doc.page.height - 26, { lineBreak: false, width: W, align: 'right' });
    }

    doc.end();

    function bloque(titulo: string, filas: Array<(string | number)[]>, anchoLabel = 14) {
      if (!filas.length) return;
      text(titulo, { bold: true, size: 10 });
      for (const f of filas) {
        text(`  ${padR(String(f[0]), anchoLabel)} ${String(f[1]).padStart(7)}   ${money(Number(f[2])).padStart(14)}`);
      }
      gap(4);
    }

    function tablaStock(titulo: string, rows: FilaStockReporte[], vacio?: string) {
      text(titulo, { bold: true, size: 11 });
      gap(1);
      const header =
        `${'SKU'.padEnd(14)} ${'PRODUCTO'.padEnd(24)} ${'VAR'.padEnd(10)} ${'SUC'.padEnd(10)} ` +
        `${'DISP'.padStart(5)} ${'MIN'.padStart(4)} ${'V.COSTO'.padStart(12)} ${'ESTADO'.padEnd(8)}`;
      const printHeader = () => { text(header, { bold: true, size: 8 }); rule(); };
      printHeader();
      if (vacio) { text(vacio, { size: 8, color: '#777777' }); return; }
      for (const s of rows) {
        if (y + 11 > bottom) { doc.addPage(); y = M; printHeader(); }
        text(
          `${padR(s.sku, 14)} ${padR(s.producto, 24)} ${padR(s.variante, 10)} ${padR(s.sucursal, 10)} ` +
          `${String(s.disponible).padStart(5)} ${String(s.stockMinimo).padStart(4)} ${num(s.valorCosto).padStart(12)} ${padR(ESTADO_LABEL[s.estado] ?? s.estado, 8)}`,
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
