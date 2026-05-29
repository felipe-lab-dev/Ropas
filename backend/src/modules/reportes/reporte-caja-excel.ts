import ExcelJS from 'exceljs';
import type { ReporteCajaDatos, FilaSesionReporte, FilaMovimientoReporte } from './reporte-caja.service';

const CATEGORIA_LABEL: Record<string, string> = {
  saldo_anterior: 'Saldo anterior', adelanto_cliente: 'Adelanto cliente', cobro_credito: 'Cobro crédito',
  devolucion_proveedor: 'Devol. proveedor', otro_ingreso: 'Otro ingreso', pago_proveedor: 'Pago proveedor',
  servicio_basico: 'Servicio básico', comision_empleado: 'Comisión', refrigerio: 'Refrigerio',
  movilidad: 'Movilidad', publicidad: 'Publicidad', devolucion_cliente: 'Devol. cliente', otro_egreso: 'Otro egreso',
};
const TIPO_LABEL: Record<string, string> = { ingreso: 'Ingreso', egreso: 'Egreso', retiro: 'Retiro', ajuste: 'Ajuste' };
const ESTADO_LABEL: Record<string, string> = { abierta: 'Abierta', cerrada: 'Cerrada', con_diferencia: 'Con diferencia' };
const MONEDA_FMT = '"S/ "#,##0.00';
const BRAND = 'FF7C3AED';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

/** Reporte de caja como Excel: hojas Resumen, Sesiones y Movimientos. Montos en S/. */
export async function generarExcelCaja(d: ReporteCajaDatos): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ropas';
  wb.created = new Date(d.generadoEn);

  construirResumen(wb, d);
  construirSesiones(wb, d);
  construirMovimientos(wb, d);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function estiloHeader(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  for (let i = 1; i <= cols; i++) row.getCell(i).alignment = { vertical: 'middle' };
}

function construirResumen(wb: ExcelJS.Workbook, d: ReporteCajaDatos) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 24 }, { width: 14 }, { width: 16 }];

  ws.addRow(['REPORTE DE CAJA']).font = { bold: true, size: 16 };
  ws.addRow([d.tenantNombre]).font = { size: 11, color: { argb: 'FF555555' } };
  ws.addRow([`Periodo: ${d.periodo.etiqueta}`]).font = { color: { argb: 'FF555555' } };
  ws.addRow([`Generado: ${fechaHora(d.generadoEn)} · montos en S/`]).font = { size: 9, color: { argb: 'FF999999' } };
  ws.addRow([]);

  const r = d.resumen;
  ws.addRow(['Sesiones']).font = { bold: true, size: 12 };
  const sesKpis: Array<[string, number, boolean?]> = [
    ['Sesiones', r.sesiones],
    ['Cerradas', r.cerradas],
    ['Abiertas', r.abiertas],
    ['Con diferencia', r.conDiferencia],
    ['Aperturas', r.aperturas, true],
    ['Cierres', r.cierres, true],
    ['Esperado', r.esperado, true],
    ['Diferencia arqueo', r.diferencia, true],
  ];
  for (const [label, valor, money] of sesKpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'Diferencia arqueo') row.font = { bold: true };
  }
  ws.addRow([]);

  ws.addRow(['Movimientos manuales']).font = { bold: true, size: 12 };
  const movKpis: Array<[string, number, boolean?]> = [
    ['Ingresos', r.ingresos, true],
    ['Egresos', r.egresos, true],
    ['Neto', r.neto, true],
    ['Movimientos', r.movimientos],
    ['En otra moneda', r.otrasMonedas],
  ];
  for (const [label, valor, money] of movKpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'Neto') row.font = { bold: true };
  }
  ws.addRow([]);

  const bloque = (titulo: string, cols: string[], filas: Array<(string | number)[]>, moneyCol: number) => {
    if (!filas.length) return;
    ws.addRow([titulo]).font = { bold: true, size: 12 };
    estiloHeader(ws.addRow(cols), cols.length);
    for (const f of filas) ws.addRow(f).getCell(moneyCol).numFmt = MONEDA_FMT;
    ws.addRow([]);
  };
  bloque('Por categoría', ['Categoría', 'Tipo', 'Cantidad', 'Monto'],
    r.porCategoria.map(c => [CATEGORIA_LABEL[c.categoria] ?? c.categoria, c.tipo === 'ingreso' ? 'Ingreso' : 'Egreso', c.cantidad, c.monto]), 4);
  bloque('Por medio de pago', ['Medio', 'Cantidad', 'Monto'],
    r.porMedio.map(m => [m.medio, m.cantidad, m.monto]), 3);
}

function construirSesiones(wb: ExcelJS.Workbook, d: ReporteCajaDatos) {
  const ws = wb.addWorksheet('Sesiones');
  ws.columns = [
    { header: 'Sucursal', key: 'sucursal', width: 18 },
    { header: 'Cajero', key: 'cajero', width: 22 },
    { header: 'Abierta', key: 'abierta', width: 18 },
    { header: 'Cerrada', key: 'cerrada', width: 18 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Apertura', key: 'apertura', width: 13 },
    { header: 'Cierre', key: 'cierre', width: 13 },
    { header: 'Esperado', key: 'esperado', width: 13 },
    { header: 'Diferencia', key: 'diferencia', width: 13 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const s of d.sesiones) {
    const row = ws.addRow({
      sucursal: s.sucursal, cajero: s.cajero,
      abierta: new Date(s.abiertaEn), cerrada: s.cerradaEn ? new Date(s.cerradaEn) : null,
      estado: ESTADO_LABEL[s.estado] ?? s.estado,
      apertura: s.apertura, cierre: s.cierre, esperado: s.esperado, diferencia: s.diferencia,
    });
    row.getCell('abierta').numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell('cerrada').numFmt = 'dd/mm/yyyy hh:mm';
    for (const k of ['apertura', 'cierre', 'esperado', 'diferencia']) row.getCell(k).numFmt = MONEDA_FMT;
    if (s.diferencia != null && Math.abs(s.diferencia) > 0.01) row.getCell('diferencia').font = { color: { argb: 'FFC0392B' }, bold: true };
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function construirMovimientos(wb: ExcelJS.Workbook, d: ReporteCajaDatos) {
  const ws = wb.addWorksheet('Movimientos');
  ws.columns = [
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Sucursal', key: 'sucursal', width: 18 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Categoría', key: 'categoria', width: 18 },
    { header: 'Medio', key: 'medio', width: 14 },
    { header: 'Moneda', key: 'moneda', width: 9 },
    { header: 'Monto', key: 'monto', width: 13 },
    { header: 'Motivo', key: 'motivo', width: 32 },
    { header: 'Contraparte', key: 'contraparte', width: 22 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const m of d.movimientos) {
    const row = ws.addRow({
      fecha: new Date(m.fecha), sucursal: m.sucursal, tipo: TIPO_LABEL[m.tipo] ?? m.tipo,
      categoria: CATEGORIA_LABEL[m.categoria] ?? m.categoria, medio: m.medio, moneda: m.moneda,
      monto: m.monto, motivo: m.motivo, contraparte: m.contraparte,
    });
    row.getCell('fecha').numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell('monto').numFmt = '#,##0.00';
    if (m.tipo === 'ingreso') row.getCell('tipo').font = { color: { argb: 'FF1E7E34' } };
    else if (m.tipo === 'egreso' || m.tipo === 'retiro') row.getCell('tipo').font = { color: { argb: 'FFC0392B' } };
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
