import ExcelJS from 'exceljs';
import type { ReporteInventarioDatos, FilaStockReporte } from './reporte-inventario.service';

const ESTADO_LABEL: Record<string, string> = { ok: 'OK', bajo: 'Bajo', agotado: 'Agotado' };
const MONEDA_FMT = '"S/ "#,##0.00';
const BRAND = 'FF7C3AED';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

/** Reporte de inventario como Excel: hojas Resumen, Stock y Alertas. Montos en S/. */
export async function generarExcelInventario(d: ReporteInventarioDatos): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ropas';
  wb.created = new Date(d.generadoEn);

  construirResumen(wb, d);
  construirStock(wb, 'Stock', d.stock);
  construirStock(wb, 'Alertas', d.alertas);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function estiloHeader(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  for (let i = 1; i <= cols; i++) row.getCell(i).alignment = { vertical: 'middle' };
}

function construirResumen(wb: ExcelJS.Workbook, d: ReporteInventarioDatos) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 26 }, { width: 16 }, { width: 18 }];

  ws.addRow(['REPORTE DE INVENTARIO']).font = { bold: true, size: 16 };
  ws.addRow([d.tenantNombre]).font = { size: 11, color: { argb: 'FF555555' } };
  ws.addRow([`Snapshot al: ${fechaHora(d.generadoEn)} · montos en S/`]).font = { size: 9, color: { argb: 'FF999999' } };
  ws.addRow([]);

  const r = d.resumen;
  ws.addRow(['Totales']).font = { bold: true, size: 12 };
  const kpis: Array<[string, number, boolean?]> = [
    ['Registros de stock', r.registros],
    ['Unidades disponibles', r.unidadesDisponibles],
    ['Reservado', r.reservado],
    ['Dañado', r.danado],
    ['Valor a costo', r.valorCosto, true],
    ['Valor a venta', r.valorVenta, true],
    ['Margen potencial', r.margenPotencial, true],
    ['Alertas (stock bajo)', r.alertasBajo],
    ['Agotados', r.agotados],
  ];
  for (const [label, valor, money] of kpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'Valor a costo') row.font = { bold: true };
  }
  ws.addRow([]);

  const bloque = (titulo: string, cols: string[], filas: Array<(string | number)[]>, moneyCol: number) => {
    if (!filas.length) return;
    ws.addRow([titulo]).font = { bold: true, size: 12 };
    estiloHeader(ws.addRow(cols), cols.length);
    for (const f of filas) {
      const row = ws.addRow(f);
      row.getCell(moneyCol).numFmt = MONEDA_FMT;
    }
    ws.addRow([]);
  };
  bloque('Por sucursal', ['Sucursal', 'Unidades', 'Valor costo'], r.porSucursal.map(s => [s.sucursal, s.unidades, s.valorCosto]), 3);
  bloque('Por categoría', ['Categoría', 'Unidades', 'Valor costo'], r.porCategoria.map(c => [c.categoria, c.unidades, c.valorCosto]), 3);
}

function construirStock(wb: ExcelJS.Workbook, nombre: string, filas: FilaStockReporte[]) {
  const ws = wb.addWorksheet(nombre);
  ws.columns = [
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Producto', key: 'producto', width: 32 },
    { header: 'Variante', key: 'variante', width: 14 },
    { header: 'Sucursal', key: 'sucursal', width: 16 },
    { header: 'Disponible', key: 'disponible', width: 11 },
    { header: 'Reservado', key: 'reservado', width: 11 },
    { header: 'Mínimo', key: 'minimo', width: 9 },
    { header: 'Costo unit.', key: 'costo', width: 12 },
    { header: 'Valor costo', key: 'valorCosto', width: 14 },
    { header: 'P. venta', key: 'precioVenta', width: 12 },
    { header: 'Valor venta', key: 'valorVenta', width: 14 },
    { header: 'Estado', key: 'estado', width: 10 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const s of filas) {
    const row = ws.addRow({
      sku: s.sku, producto: s.producto, variante: s.variante, sucursal: s.sucursal,
      disponible: s.disponible, reservado: s.reservado, minimo: s.stockMinimo,
      costo: s.costoUnit, valorCosto: s.valorCosto, precioVenta: s.precioVenta, valorVenta: s.valorVenta,
      estado: ESTADO_LABEL[s.estado] ?? s.estado,
    });
    for (const k of ['costo', 'valorCosto', 'precioVenta', 'valorVenta']) row.getCell(k).numFmt = MONEDA_FMT;
    if (s.estado === 'agotado') row.getCell('estado').font = { color: { argb: 'FFC0392B' }, bold: true };
    else if (s.estado === 'bajo') row.getCell('estado').font = { color: { argb: 'FFB9770E' }, bold: true };
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
