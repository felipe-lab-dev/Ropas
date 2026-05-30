import ExcelJS from 'exceljs';
import type { ReporteContabilidadDatos } from './reporte-contabilidad.service';

const TIPO_LABEL: Record<string, string> = {
  asiento_manual: 'Manual', venta: 'Venta', compra: 'Compra', pago_compra: 'Pago compra',
  cobro_venta: 'Cobro venta', nota_credito: 'Nota crédito', ajuste: 'Ajuste', apertura: 'Apertura', cierre: 'Cierre',
};
const MONEDA_FMT = '"S/ "#,##0.00';
const BRAND = 'FF7C3AED';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

/** Reporte contable (libro diario) como Excel: Resumen, Asientos, Detalle y Por cuenta. */
export async function generarExcelContabilidad(d: ReporteContabilidadDatos): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ropas';
  wb.created = new Date(d.generadoEn);

  construirResumen(wb, d);
  construirAsientos(wb, d);
  construirDetalle(wb, d);
  construirPorCuenta(wb, d);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function estiloHeader(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  for (let i = 1; i <= cols; i++) row.getCell(i).alignment = { vertical: 'middle' };
}

function construirResumen(wb: ExcelJS.Workbook, d: ReporteContabilidadDatos) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 24 }, { width: 14 }, { width: 16 }];

  ws.addRow(['REPORTE CONTABLE — LIBRO DIARIO']).font = { bold: true, size: 15 };
  ws.addRow([d.tenantNombre]).font = { size: 11, color: { argb: 'FF555555' } };
  ws.addRow([`Periodo: ${d.periodo.etiqueta}`]).font = { color: { argb: 'FF555555' } };
  ws.addRow([`Generado: ${fechaHora(d.generadoEn)} · montos en S/`]).font = { size: 9, color: { argb: 'FF999999' } };
  ws.addRow([]);

  const r = d.resumen;
  ws.addRow(['Totales']).font = { bold: true, size: 12 };
  const kpis: Array<[string, number, boolean?]> = [
    ['Asientos', r.asientos],
    ['Total debe', r.totalDebe, true],
    ['Total haber', r.totalHaber, true],
    ['Descuadre', r.descuadre, true],
  ];
  for (const [label, valor, money] of kpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'Descuadre' && Math.abs(r.descuadre) > 0.01) row.getCell(2).font = { color: { argb: 'FFC0392B' }, bold: true };
  }
  ws.addRow([]);

  if (r.porTipoOperacion.length) {
    ws.addRow(['Por tipo de operación']).font = { bold: true, size: 12 };
    estiloHeader(ws.addRow(['Tipo', 'Cantidad', 'Debe']), 3);
    for (const t of r.porTipoOperacion) ws.addRow([TIPO_LABEL[t.tipo] ?? t.tipo, t.cantidad, t.debe]).getCell(3).numFmt = MONEDA_FMT;
  }
}

function construirAsientos(wb: ExcelJS.Workbook, d: ReporteContabilidadDatos) {
  const ws = wb.addWorksheet('Asientos');
  ws.columns = [
    { header: 'Número', key: 'numero', width: 18 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Glosa', key: 'glosa', width: 40 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Debe', key: 'debe', width: 14 },
    { header: 'Haber', key: 'haber', width: 14 },
    { header: 'Estado', key: 'estado', width: 12 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const a of d.asientos) {
    const row = ws.addRow({
      numero: a.numero, fecha: new Date(a.fecha), glosa: a.glosa, tipo: TIPO_LABEL[a.tipoOperacion] ?? a.tipoOperacion,
      debe: a.debe, haber: a.haber, estado: a.estado,
    });
    row.getCell('fecha').numFmt = 'dd/mm/yyyy';
    row.getCell('debe').numFmt = MONEDA_FMT;
    row.getCell('haber').numFmt = MONEDA_FMT;
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function construirDetalle(wb: ExcelJS.Workbook, d: ReporteContabilidadDatos) {
  const ws = wb.addWorksheet('Detalle');
  ws.columns = [
    { header: 'Asiento', key: 'numero', width: 18 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Cuenta', key: 'codigo', width: 12 },
    { header: 'Nombre cuenta', key: 'nombre', width: 36 },
    { header: 'Glosa', key: 'glosa', width: 32 },
    { header: 'Debe', key: 'debe', width: 14 },
    { header: 'Haber', key: 'haber', width: 14 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const det of d.detalle) {
    const row = ws.addRow({
      numero: det.numero, fecha: new Date(det.fecha), codigo: det.cuentaCodigo, nombre: det.cuentaNombre,
      glosa: det.glosa, debe: det.debe, haber: det.haber,
    });
    row.getCell('fecha').numFmt = 'dd/mm/yyyy';
    row.getCell('debe').numFmt = MONEDA_FMT;
    row.getCell('haber').numFmt = MONEDA_FMT;
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function construirPorCuenta(wb: ExcelJS.Workbook, d: ReporteContabilidadDatos) {
  const ws = wb.addWorksheet('Por cuenta');
  ws.columns = [
    { header: 'Cuenta', key: 'codigo', width: 14 },
    { header: 'Nombre', key: 'nombre', width: 40 },
    { header: 'Debe', key: 'debe', width: 14 },
    { header: 'Haber', key: 'haber', width: 14 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const c of d.porCuenta) {
    const row = ws.addRow({ codigo: c.codigo, nombre: c.nombre, debe: c.debe, haber: c.haber });
    row.getCell('debe').numFmt = MONEDA_FMT;
    row.getCell('haber').numFmt = MONEDA_FMT;
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
