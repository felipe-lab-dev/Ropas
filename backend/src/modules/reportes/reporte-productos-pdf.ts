import PDFDocument from 'pdfkit';
import type { ReporteProductosDatos, FilaProductoCatalogo } from './reporte-productos.service';

/** Reporte de productos (catálogo) como PDF monoespaciado. Montos en S/. */
export function generarPdfProductos(d: ReporteProductosDatos): Promise<Buffer> {
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

    text('REPORTE DE PRODUCTOS (catálogo)', { bold: true, size: 16 });
    text(d.tenantNombre.toUpperCase(), { size: 10, color: '#444444' });
    text(`Snapshot al: ${fechaHora(d.generadoEn)}    (montos en S/)`, { size: 8, color: '#777777' });
    gap();
    rule();

    const r = d.resumen;
    text('RESUMEN', { bold: true, size: 11 });
    gap(2);
    text(`Productos        : ${r.total}  (activos ${r.activos} / inactivos ${r.inactivos})`);
    text(`Variantes        : ${r.variantes}`);
    text(`Unidades en stock: ${r.unidadesStock}`);
    text(`Valor a costo    : ${money(r.valorCosto)}`, { bold: true });
    text(`Valor a venta    : ${money(r.valorVenta)}`);
    text(`Sin precio compra: ${r.sinPrecioCompra}`);
    gap();

    bloque('POR CATEGORÍA', r.porCategoria.slice(0, 15).map(c => [c.categoria, c.cantidad, c.valorCosto]), 22);
    if (r.porClasificacion.length) {
      text('POR CLASIFICACIÓN ABC', { bold: true, size: 10 });
      for (const c of r.porClasificacion) text(`  ${padR(c.clasificacion, 16)} ${String(c.cantidad).padStart(6)}`);
      gap(4);
    }
    if (d.truncado) text(`NOTA: el reporte se limitó a los primeros ${d.productos.length} productos.`, { size: 8, color: '#a15c00' });

    doc.addPage(); y = M;
    tabla('CATÁLOGO', d.productos, d.productos.length === 0 ? 'Sin productos para los filtros.' : undefined);

    doc.addPage(); y = M;
    tabla('TOP 20 POR VALOR DE STOCK (a costo)', d.top, d.top.length === 0 ? 'Sin stock valorizado.' : undefined);

    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc.font('Courier').fontSize(7).fillColor('#999999')
        .text(`${d.tenantNombre} · Reporte de productos`, M, doc.page.height - 26, { lineBreak: false, width: W })
        .text(`Página ${i + 1} de ${rango.count}`, M, doc.page.height - 26, { lineBreak: false, width: W, align: 'right' });
    }

    doc.end();

    function bloque(titulo: string, filas: Array<(string | number)[]>, anchoLabel = 14) {
      if (!filas.length) return;
      text(titulo, { bold: true, size: 10 });
      for (const f of filas) text(`  ${padR(String(f[0]), anchoLabel)} ${String(f[1]).padStart(6)}   ${money(Number(f[2])).padStart(14)}`);
      gap(4);
    }
    function tabla(titulo: string, rows: FilaProductoCatalogo[], vacio?: string) {
      text(titulo, { bold: true, size: 11 });
      gap(1);
      const header =
        `${'SKU'.padEnd(12)} ${'PRODUCTO'.padEnd(26)} ${'CATEGORÍA'.padEnd(14)} ${'P.VENTA'.padStart(9)} ${'P.COMPRA'.padStart(9)} ${'MARGEN'.padStart(7)} ${'STOCK'.padStart(6)}`;
      const printHeader = () => { text(header, { bold: true, size: 8 }); rule(); };
      printHeader();
      if (vacio) { text(vacio, { size: 8, color: '#777777' }); return; }
      for (const p of rows) {
        if (y + 11 > bottom) { doc.addPage(); y = M; printHeader(); }
        text(
          `${padR(p.sku, 12)} ${padR(p.nombre, 26)} ${padR(p.categoria, 14)} ${num(p.precioVenta).padStart(9)} ` +
          `${(p.precioCompra != null ? num(p.precioCompra) : '—').padStart(9)} ${(p.margenPct != null ? `${p.margenPct >= 0 ? '+' : '-'}${Math.abs(Math.round(p.margenPct))}%` : '—').padStart(7)} ${String(p.stock).padStart(6)}`,
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
