import ExcelJS from 'exceljs';
import type { ReporteClientesDatos, FilaClienteReporte } from './reporte-clientes.service';

const CLASE_LABEL: Record<string, string> = {
  AA: 'AA · VIP', A: 'A · Top', B: 'B · Sólidos', C: 'C · Ocasionales', D: 'D · Fríos',
  'Sin clasificar': 'Sin clasificar',
};
const MONEDA_FMT = '"S/ "#,##0.00';
const BRAND = 'FF7C3AED';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

/** Reporte de clientes como Excel: hojas Resumen, Clientes y Top. Montos en S/. */
export async function generarExcelClientes(d: ReporteClientesDatos): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ropas';
  wb.created = new Date(d.generadoEn);

  construirResumen(wb, d);
  construirClientes(wb, 'Clientes', d.clientes);
  construirClientes(wb, 'Top compradores', d.top);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function estiloHeader(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  for (let i = 1; i <= cols; i++) row.getCell(i).alignment = { vertical: 'middle' };
}

function construirResumen(wb: ExcelJS.Workbook, d: ReporteClientesDatos) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 24 }, { width: 14 }, { width: 16 }];

  ws.addRow(['REPORTE DE CLIENTES']).font = { bold: true, size: 16 };
  ws.addRow([d.tenantNombre]).font = { size: 11, color: { argb: 'FF555555' } };
  ws.addRow([`Snapshot al: ${fechaHora(d.generadoEn)} · montos en S/`]).font = { size: 9, color: { argb: 'FF999999' } };
  ws.addRow([]);

  const r = d.resumen;
  ws.addRow(['Totales']).font = { bold: true, size: 12 };
  const kpis: Array<[string, number, boolean?]> = [
    ['Clientes', r.total],
    ['Con compras', r.conCompras],
    ['Sin compras', r.sinCompras],
    ['Total comprado', r.totalCompras, true],
    ['Ticket promedio', r.ticketPromedio, true],
  ];
  for (const [label, valor, money] of kpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'Total comprado') row.font = { bold: true };
  }
  ws.addRow([]);

  if (r.porClasificacion.length) {
    ws.addRow(['Por clasificación (RFM)']).font = { bold: true, size: 12 };
    estiloHeader(ws.addRow(['Clase', 'Cantidad', 'Comprado']), 3);
    for (const c of r.porClasificacion) {
      const row = ws.addRow([CLASE_LABEL[c.clasificacion] ?? c.clasificacion, c.cantidad, c.compras]);
      row.getCell(3).numFmt = MONEDA_FMT;
    }
  }
}

function construirClientes(wb: ExcelJS.Workbook, nombre: string, filas: FilaClienteReporte[]) {
  const ws = wb.addWorksheet(nombre);
  ws.columns = [
    { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 8 },
    { header: 'Documento', key: 'documento', width: 14 },
    { header: 'Teléfono', key: 'telefono', width: 14 },
    { header: 'Ciudad', key: 'ciudad', width: 16 },
    { header: 'Clase', key: 'clase', width: 8 },
    { header: 'Total comprado', key: 'comprado', width: 16 },
    { header: 'Última compra', key: 'ultima', width: 16 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const c of filas) {
    const row = ws.addRow({
      codigo: c.codigo, nombre: c.nombre, tipo: c.tipoDocumento.toUpperCase(), documento: c.documento,
      telefono: c.telefono, ciudad: c.ciudad, clase: c.clasificacion, comprado: c.totalCompras,
      ultima: c.ultimaCompraEn ? new Date(c.ultimaCompraEn) : null,
    });
    row.getCell('comprado').numFmt = MONEDA_FMT;
    row.getCell('ultima').numFmt = 'dd/mm/yyyy';
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
