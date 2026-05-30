import ExcelJS from 'exceljs';
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
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  recibida: 'Recibida',
  anulada: 'Anulada',
};

const MONEDA_FMT = '"S/ "#,##0.00';
const BRAND = 'FF7C3AED';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

/** Reporte de compras como Excel (.xlsx): hojas Resumen, Compras y Productos. Montos en S/. */
export async function generarExcelCompras(d: ReporteComprasDatos): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ropas';
  wb.created = new Date(d.generadoEn);

  construirResumen(wb, d);
  construirCompras(wb, d);
  construirProductos(wb, d);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function tituloFila(ws: ExcelJS.Worksheet, texto: string, size = 14) {
  const row = ws.addRow([texto]);
  row.font = { bold: true, size };
  return row;
}

function estiloHeader(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  for (let i = 1; i <= cols; i++) row.getCell(i).alignment = { vertical: 'middle' };
}

function construirResumen(wb: ExcelJS.Workbook, d: ReporteComprasDatos) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 28 }, { width: 18 }, { width: 18 }];

  tituloFila(ws, 'REPORTE DE COMPRAS', 16);
  ws.addRow([d.tenantNombre]).font = { size: 11, color: { argb: 'FF555555' } };
  ws.addRow([`Periodo: ${d.periodo.etiqueta}`]).font = { color: { argb: 'FF555555' } };
  ws.addRow([`Generado: ${fechaHora(d.generadoEn)} · montos en S/`]).font = { size: 9, color: { argb: 'FF999999' } };
  ws.addRow([]);

  const r = d.resumen;
  tituloFila(ws, 'Totales', 12);
  const kpis: Array<[string, number, boolean?]> = [
    ['Compras (no anuladas)', r.cantidadCompras],
    ['Anuladas', r.cantidadAnuladas],
    ['Subtotal', r.subtotal, true],
    ['Descuentos', r.descuento, true],
    ['IGV', r.igv, true],
    ['Otros impuestos', r.otros, true],
    ['TOTAL', r.total, true],
    ['Pagado', r.totalPagado, true],
    ['Por pagar', r.porPagar, true],
  ];
  for (const [label, valor, money] of kpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'TOTAL') row.font = { bold: true };
  }
  ws.addRow([]);

  const bloque = (titulo: string, cols: string[], filas: Array<(string | number)[]>) => {
    if (filas.length === 0) return;
    tituloFila(ws, titulo, 12);
    const head = ws.addRow(cols);
    estiloHeader(head, cols.length);
    for (const f of filas) {
      const row = ws.addRow(f);
      row.getCell(3).numFmt = MONEDA_FMT;
    }
    ws.addRow([]);
  };

  bloque('Por estado de pago', ['Estado', 'Cantidad', 'Total'],
    r.porEstadoPago.map(e => [ESTADO_PAGO_LABEL[e.estadoPago] ?? e.estadoPago, e.cantidad, e.total]));
  bloque('Por proveedor', ['Proveedor', 'Cantidad', 'Total'],
    r.porProveedor.map(p => [p.proveedor, p.cantidad, p.total]));
  if (r.porSucursal.length > 1) {
    bloque('Por sucursal', ['Sucursal', 'Cantidad', 'Total'],
      r.porSucursal.map(s => [s.sucursal, s.cantidad, s.total]));
  }
  bloque('Por tipo de comprobante', ['Tipo', 'Cantidad', 'Total'],
    r.porTipoComprobante.map(t => [TIPO_LABEL[t.tipo] ?? t.tipo, t.cantidad, t.total]));
}

function construirCompras(wb: ExcelJS.Workbook, d: ReporteComprasDatos) {
  const ws = wb.addWorksheet('Compras');
  ws.columns = [
    { header: 'Número', key: 'numero', width: 16 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Comprobante', key: 'comprobante', width: 16 },
    { header: 'Tipo', key: 'tipo', width: 13 },
    { header: 'Proveedor', key: 'proveedor', width: 30 },
    { header: 'Sucursal', key: 'sucursal', width: 18 },
    { header: 'Ítems', key: 'items', width: 8 },
    { header: 'Moneda', key: 'moneda', width: 9 },
    { header: 'Total (orig.)', key: 'total', width: 14 },
    { header: 'Total S/', key: 'totalPen', width: 14 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Pago', key: 'pago', width: 12 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const c of d.compras) {
    const row = ws.addRow({
      numero: c.numero,
      fecha: new Date(c.fecha),
      comprobante: c.comprobante,
      tipo: TIPO_LABEL[c.tipoComprobante] ?? c.tipoComprobante,
      proveedor: c.proveedor,
      sucursal: c.sucursal,
      items: c.items,
      moneda: c.moneda,
      total: c.total,
      totalPen: c.totalPen,
      estado: ESTADO_LABEL[c.estado] ?? c.estado,
      pago: ESTADO_PAGO_LABEL[c.estadoPago] ?? c.estadoPago,
    });
    row.getCell('fecha').numFmt = 'dd/mm/yyyy';
    row.getCell('total').numFmt = '#,##0.00';
    row.getCell('totalPen').numFmt = MONEDA_FMT;
    if (c.estado === 'anulada') row.font = { color: { argb: 'FF999999' }, strike: true };
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function construirProductos(wb: ExcelJS.Workbook, d: ReporteComprasDatos) {
  const ws = wb.addWorksheet('Productos');
  ws.columns = [
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Producto', key: 'nombre', width: 34 },
    { header: 'Unidades', key: 'unidades', width: 10 },
    { header: 'Costo total S/', key: 'costo', width: 16 },
    { header: 'Compras', key: 'compras', width: 10 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of d.productos) {
    const row = ws.addRow({
      sku: p.sku,
      nombre: p.nombre,
      unidades: p.unidades,
      costo: p.costoTotal,
      compras: p.compras,
    });
    row.getCell('costo').numFmt = MONEDA_FMT;
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
