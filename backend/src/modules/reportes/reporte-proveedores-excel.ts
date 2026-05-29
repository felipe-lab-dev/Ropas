import ExcelJS from 'exceljs';
import type { ReporteProveedoresDatos, FilaProveedorReporte } from './reporte-proveedores.service';

const CONDICION_LABEL: Record<string, string> = {
  contado: 'Contado',
  credito_15: 'Crédito 15d',
  credito_30: 'Crédito 30d',
  credito_60: 'Crédito 60d',
  credito_otro: 'Crédito otro',
};
const MONEDA_FMT = '"S/ "#,##0.00';
const BRAND = 'FF7C3AED';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

/** Reporte de proveedores como Excel: hojas Resumen, Proveedores y Deudas. Montos en S/. */
export async function generarExcelProveedores(d: ReporteProveedoresDatos): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ropas';
  wb.created = new Date(d.generadoEn);

  construirResumen(wb, d);
  construirProveedores(wb, 'Proveedores', d.proveedores);
  construirProveedores(wb, 'Deudas', d.deudas);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function estiloHeader(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  for (let i = 1; i <= cols; i++) row.getCell(i).alignment = { vertical: 'middle' };
}

function construirResumen(wb: ExcelJS.Workbook, d: ReporteProveedoresDatos) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 24 }, { width: 14 }, { width: 16 }, { width: 16 }];

  ws.addRow(['REPORTE DE PROVEEDORES']).font = { bold: true, size: 16 };
  ws.addRow([d.tenantNombre]).font = { size: 11, color: { argb: 'FF555555' } };
  ws.addRow([`Snapshot al: ${fechaHora(d.generadoEn)} · montos en S/`]).font = { size: 9, color: { argb: 'FF999999' } };
  ws.addRow([]);

  const r = d.resumen;
  ws.addRow(['Totales']).font = { bold: true, size: 12 };
  const kpis: Array<[string, number | string, boolean?]> = [
    ['Proveedores', r.total],
    ['Activos', r.activos],
    ['Inactivos', r.inactivos],
    ['Total comprado', r.totalComprado, true],
    ['Deuda actual', r.deudaTotal, true],
    ['Con deuda', r.conDeuda],
  ];
  for (const [label, valor, money] of kpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'Deuda actual' || label === 'Total comprado') row.font = { bold: true };
  }
  ws.addRow([]);

  if (r.porCondicionPago.length) {
    ws.addRow(['Por condición de pago']).font = { bold: true, size: 12 };
    estiloHeader(ws.addRow(['Condición', 'Cantidad', 'Comprado', 'Deuda']), 4);
    for (const c of r.porCondicionPago) {
      const row = ws.addRow([CONDICION_LABEL[c.condicion] ?? c.condicion, c.cantidad, c.comprado, c.deuda]);
      row.getCell(3).numFmt = MONEDA_FMT;
      row.getCell(4).numFmt = MONEDA_FMT;
    }
  }
}

function construirProveedores(wb: ExcelJS.Workbook, nombre: string, filas: FilaProveedorReporte[]) {
  const ws = wb.addWorksheet(nombre);
  ws.columns = [
    { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Razón social', key: 'razonSocial', width: 32 },
    { header: 'Tipo', key: 'tipo', width: 8 },
    { header: 'Documento', key: 'documento', width: 14 },
    { header: 'Contacto', key: 'contacto', width: 20 },
    { header: 'Teléfono', key: 'telefono', width: 14 },
    { header: 'Condición', key: 'condicion', width: 14 },
    { header: 'Días créd.', key: 'dias', width: 10 },
    { header: 'Total comprado', key: 'comprado', width: 16 },
    { header: 'Deuda actual', key: 'deuda', width: 14 },
    { header: 'Estado', key: 'estado', width: 10 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of filas) {
    const row = ws.addRow({
      codigo: p.codigo,
      razonSocial: p.razonSocial,
      tipo: p.tipoDocumento.toUpperCase(),
      documento: p.documento,
      contacto: p.contacto,
      telefono: p.telefono,
      condicion: CONDICION_LABEL[p.condicionPago] ?? p.condicionPago,
      dias: p.diasCredito,
      comprado: p.totalComprado,
      deuda: p.deudaActual,
      estado: p.activo ? 'Activo' : 'Inactivo',
    });
    row.getCell('comprado').numFmt = MONEDA_FMT;
    row.getCell('deuda').numFmt = MONEDA_FMT;
    if (p.deudaActual > 0.01) row.getCell('deuda').font = { color: { argb: 'FFC0392B' }, bold: true };
    if (!p.activo) row.font = { color: { argb: 'FF999999' } };
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
