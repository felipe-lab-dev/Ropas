import PDFDocument from 'pdfkit';
import type { ReporteCajaDatos, FilaSesionReporte, FilaMovimientoReporte } from './reporte-caja.service';

const CATEGORIA_LABEL: Record<string, string> = {
  saldo_anterior: 'Saldo anterior', adelanto_cliente: 'Adelanto cliente', cobro_credito: 'Cobro crédito',
  devolucion_proveedor: 'Devol. proveedor', otro_ingreso: 'Otro ingreso', pago_proveedor: 'Pago proveedor',
  servicio_basico: 'Servicio básico', comision_empleado: 'Comisión', refrigerio: 'Refrigerio',
  movilidad: 'Movilidad', publicidad: 'Publicidad', devolucion_cliente: 'Devol. cliente', otro_egreso: 'Otro egreso',
};
const TIPO_LABEL: Record<string, string> = { ingreso: 'Ingreso', egreso: 'Egreso', retiro: 'Retiro', ajuste: 'Ajuste' };
const ESTADO_LABEL: Record<string, string> = { abierta: 'Abierta', cerrada: 'Cerrada', con_diferencia: 'Con dif.' };

/** Reporte de caja como PDF monoespaciado. Montos en S/ (otras monedas se listan en el detalle). */
export function generarPdfCaja(d: ReporteCajaDatos): Promise<Buffer> {
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

    text('REPORTE DE CAJA', { bold: true, size: 16 });
    text(d.tenantNombre.toUpperCase(), { size: 10, color: '#444444' });
    text(`Periodo: ${d.periodo.etiqueta}`, { size: 9, color: '#444444' });
    text(`Generado: ${fechaHora(d.generadoEn)}    (montos en S/)`, { size: 8, color: '#777777' });
    gap();
    rule();

    const r = d.resumen;
    text('RESUMEN', { bold: true, size: 11 });
    gap(2);
    text(`Sesiones          : ${r.sesiones}  (cerradas ${r.cerradas} / abiertas ${r.abiertas} / con dif. ${r.conDiferencia})`);
    text(`Aperturas         : ${money(r.aperturas)}`);
    text(`Cierres           : ${money(r.cierres)}`);
    text(`Esperado          : ${money(r.esperado)}`);
    text(`Diferencia arqueo : ${money(r.diferencia)}`, { bold: true });
    gap(2);
    text('MOVIMIENTOS MANUALES', { bold: true, size: 10 });
    text(`Ingresos          : ${money(r.ingresos)}`);
    text(`Egresos           : ${money(r.egresos)}`);
    text(`Neto              : ${money(r.neto)}`, { bold: true });
    if (r.otrasMonedas > 0) {
      text(`(${r.otrasMonedas} movimiento(s) en otra moneda — ver detalle; no sumados al total en S/)`, { size: 7.5, color: '#a15c00' });
    }
    gap();

    bloque('POR CATEGORÍA', r.porCategoria.map(c => [`${CATEGORIA_LABEL[c.categoria] ?? c.categoria} (${c.tipo === 'ingreso' ? '+' : '-'})`, c.cantidad, c.monto]), 22);
    bloque('POR MEDIO DE PAGO', r.porMedio.map(m => [m.medio, m.cantidad, m.monto]), 16);
    if (d.truncado) {
      text('NOTA: el reporte se truncó por volumen (tope alcanzado).', { size: 8, color: '#a15c00' });
    }

    // Sesiones
    doc.addPage(); y = M;
    text('SESIONES DE CAJA', { bold: true, size: 11 });
    gap(1);
    const headSes = `${'FECHA'.padEnd(8)} ${'SUCURSAL'.padEnd(16)} ${'CAJERO'.padEnd(18)} ${'ESTADO'.padEnd(9)} ${'APERTURA'.padStart(12)} ${'CIERRE'.padStart(12)} ${'DIF.'.padStart(10)}`;
    tabla(headSes, listaSes(d.sesiones), d.sesiones.length === 0 ? 'Sin sesiones en el período.' : undefined);

    // Movimientos
    doc.addPage(); y = M;
    text('MOVIMIENTOS DE CAJA', { bold: true, size: 11 });
    gap(1);
    const headMov = `${'FECHA'.padEnd(8)} ${'TIPO'.padEnd(8)} ${'CATEGORÍA'.padEnd(18)} ${'MEDIO'.padEnd(12)} ${'MON'.padEnd(3)} ${'MONTO'.padStart(12)} ${'MOTIVO'.padEnd(20)}`;
    tabla(headMov, listaMov(d.movimientos), d.movimientos.length === 0 ? 'Sin movimientos en el período.' : undefined);

    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc.font('Courier').fontSize(7).fillColor('#999999')
        .text(`${d.tenantNombre} · Reporte de caja · ${d.periodo.etiqueta}`, M, doc.page.height - 26, { lineBreak: false, width: W })
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
    function tabla(header: string, rows: string[], vacio?: string) {
      const printHeader = () => { text(header, { bold: true, size: 8 }); rule(); };
      printHeader();
      if (vacio) { text(vacio, { size: 8, color: '#777777' }); return; }
      for (const row of rows) {
        if (y + 11 > bottom) { doc.addPage(); y = M; printHeader(); }
        text(row, { size: 8 });
      }
    }
    function listaSes(rows: FilaSesionReporte[]): string[] {
      return rows.map(s =>
        `${fecha(s.abiertaEn).padEnd(8)} ${padR(s.sucursal, 16)} ${padR(s.cajero, 18)} ${padR(ESTADO_LABEL[s.estado] ?? s.estado, 9)} ` +
        `${num(s.apertura).padStart(12)} ${(s.cierre != null ? num(s.cierre) : '—').padStart(12)} ${(s.diferencia != null ? num(s.diferencia) : '—').padStart(10)}`,
      );
    }
    function listaMov(rows: FilaMovimientoReporte[]): string[] {
      return rows.map(m =>
        `${fecha(m.fecha).padEnd(8)} ${padR(TIPO_LABEL[m.tipo] ?? m.tipo, 8)} ${padR(CATEGORIA_LABEL[m.categoria] ?? m.categoria, 18)} ${padR(m.medio, 12)} ${padR(m.moneda, 3)} ${num(m.monto).padStart(12)} ${padR(m.motivo, 20)}`,
      );
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
