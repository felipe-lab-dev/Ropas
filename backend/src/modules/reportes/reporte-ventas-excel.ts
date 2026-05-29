import ExcelJS from 'exceljs';
import type { ReporteVentasDatos } from './reporte-ventas.service';

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  confirmada: 'Confirmada',
  pagada: 'Pagada',
  parcial: 'Parcial',
  anulada: 'Anulada',
};

const NIVEL_LABEL: Record<string, string> = {
  saludable: 'Saludable',
  aceptable: 'Aceptable',
  bajo: 'Bajo',
  perdida: 'Pérdida',
  sin_datos: 'Sin datos',
  parcial: 'Parcial',
};

const MONEDA_FMT = '"S/ "#,##0.00';
const PCT_FMT = '0.0"%"';
const BRAND = 'FF7C3AED'; // violeta marca Ropas
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: BRAND },
};

/** Genera el reporte de ventas como Excel (.xlsx) con hojas Resumen, Ventas y Productos. */
export async function generarExcelVentas(d: ReporteVentasDatos): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ropas';
  wb.created = new Date(d.generadoEn);

  construirResumen(wb, d);
  construirVentas(wb, d);
  construirProductos(wb, d);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function tituloFila(ws: ExcelJS.Worksheet, texto: string, size = 14) {
  const row = ws.addRow([texto]);
  row.font = { bold: true, size };
  return row;
}

function construirResumen(wb: ExcelJS.Workbook, d: ReporteVentasDatos) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 26 }, { width: 18 }, { width: 18 }];

  tituloFila(ws, 'REPORTE DE VENTAS', 16);
  ws.addRow([d.tenantNombre]).font = { size: 11, color: { argb: 'FF555555' } };
  ws.addRow([`Periodo: ${d.periodo.etiqueta}`]).font = { color: { argb: 'FF555555' } };
  ws.addRow([`Generado: ${fechaHora(d.generadoEn)}`]).font = { size: 9, color: { argb: 'FF999999' } };
  ws.addRow([]);

  const r = d.resumen;
  tituloFila(ws, 'Totales', 12);
  const kpis: Array<[string, number, boolean?]> = [
    ['Ventas (no anuladas)', r.cantidadVentas],
    ['Anuladas', r.cantidadAnuladas],
    ['Subtotal', r.subtotal, true],
    ['Descuentos', r.descuentos, true],
    ['IGV / Impuestos', r.impuestos, true],
    ['TOTAL', r.total, true],
    ['Pagado', r.totalPagado, true],
    ['Por cobrar', r.porCobrar, true],
  ];
  for (const [label, valor, money] of kpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'TOTAL') row.font = { bold: true };
  }
  ws.addRow([]);

  tituloFila(ws, 'Rentabilidad', 12);
  const rent: Array<[string, number | string]> = [
    ['Ingreso neto', r.rentabilidad.ingresoNeto],
    ['Costo total', r.rentabilidad.costoTotal],
    ['Ganancia', r.rentabilidad.ganancia],
  ];
  for (const [label, valor] of rent) {
    const row = ws.addRow([label, valor]);
    row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'Ganancia') row.font = { bold: true };
  }
  const margenRow = ws.addRow(['Margen', r.rentabilidad.margenPct ?? '—']);
  if (r.rentabilidad.margenPct !== null) margenRow.getCell(2).numFmt = PCT_FMT;
  const markupRow = ws.addRow(['Markup', r.rentabilidad.markupPct ?? '—']);
  if (r.rentabilidad.markupPct !== null) markupRow.getCell(2).numFmt = PCT_FMT;
  ws.addRow(['Ítems con costo', `${r.rentabilidad.itemsConCosto}/${r.rentabilidad.itemsTotal}`]);
  ws.addRow([]);

  // Desgloses
  const bloque = (titulo: string, cols: string[], filas: Array<(string | number)[]>, moneyCol = 2) => {
    tituloFila(ws, titulo, 12);
    const head = ws.addRow(cols);
    estiloHeader(head, cols.length);
    for (const f of filas) {
      const row = ws.addRow(f);
      row.getCell(moneyCol + 1).numFmt = MONEDA_FMT;
    }
    ws.addRow([]);
  };

  bloque('Por estado', ['Estado', 'Cantidad', 'Total'],
    r.porEstado.map(e => [ESTADO_LABEL[e.estado] ?? e.estado, e.cantidad, e.total]));
  bloque('Por medio de pago', ['Medio', 'Cantidad', 'Monto'],
    r.porMedioPago.map(m => [m.medio, m.cantidad, m.monto]));
  if (r.porSucursal.length > 1) {
    bloque('Por sucursal', ['Sucursal', 'Cantidad', 'Total'],
      r.porSucursal.map(s => [s.sucursal, s.cantidad, s.total]));
  }
}

function construirVentas(wb: ExcelJS.Workbook, d: ReporteVentasDatos) {
  const ws = wb.addWorksheet('Ventas');
  ws.columns = [
    { header: 'Número', key: 'numero', width: 16 },
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Cliente', key: 'cliente', width: 28 },
    { header: 'Vendedor', key: 'vendedor', width: 20 },
    { header: 'Sucursal', key: 'sucursal', width: 18 },
    { header: 'Ítems', key: 'items', width: 8 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Estado', key: 'estado', width: 13 },
    { header: 'Margen', key: 'margen', width: 10 },
    { header: 'Nivel', key: 'nivel', width: 12 },
    { header: 'Nota venta', key: 'nv', width: 11 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const v of d.ventas) {
    const row = ws.addRow({
      numero: v.numero,
      fecha: new Date(v.fecha),
      cliente: v.cliente,
      vendedor: v.vendedor,
      sucursal: v.sucursal,
      items: v.items,
      total: v.total,
      estado: ESTADO_LABEL[v.estado] ?? v.estado,
      margen: v.margenPct ?? null,
      nivel: NIVEL_LABEL[v.nivel] ?? v.nivel,
      nv: v.esNotaDeVenta ? 'Sí' : '',
    });
    row.getCell('fecha').numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell('total').numFmt = MONEDA_FMT;
    if (v.margenPct !== null) row.getCell('margen').numFmt = PCT_FMT;
    if (v.estado === 'anulada') row.font = { color: { argb: 'FF999999' }, strike: true };
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function construirProductos(wb: ExcelJS.Workbook, d: ReporteVentasDatos) {
  const ws = wb.addWorksheet('Productos');
  ws.columns = [
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Producto', key: 'nombre', width: 34 },
    { header: 'Unidades', key: 'unidades', width: 10 },
    { header: 'Ingreso', key: 'ingreso', width: 14 },
    { header: 'Costo', key: 'costo', width: 14 },
    { header: 'Ganancia', key: 'ganancia', width: 14 },
    { header: 'Margen', key: 'margen', width: 10 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of d.productos) {
    const row = ws.addRow({
      sku: p.sku,
      nombre: p.nombre,
      unidades: p.unidades,
      ingreso: p.ingreso,
      costo: p.conCosto ? p.costo : null,
      ganancia: p.conCosto ? p.ganancia : null,
      margen: p.margenPct ?? null,
    });
    row.getCell('ingreso').numFmt = MONEDA_FMT;
    if (p.conCosto) {
      row.getCell('costo').numFmt = MONEDA_FMT;
      row.getCell('ganancia').numFmt = MONEDA_FMT;
    }
    if (p.margenPct !== null) row.getCell('margen').numFmt = PCT_FMT;
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function estiloHeader(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  for (let i = 1; i <= cols; i++) {
    row.getCell(i).alignment = { vertical: 'middle' };
  }
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
