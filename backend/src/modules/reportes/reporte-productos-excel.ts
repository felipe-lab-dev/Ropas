import ExcelJS from 'exceljs';
import type { ReporteProductosDatos, FilaProductoCatalogo } from './reporte-productos.service';

const MONEDA_FMT = '"S/ "#,##0.00';
const PCT_FMT = '0.0"%"';
const BRAND = 'FF7C3AED';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

/** Reporte de productos como Excel: hojas Resumen, Catálogo y Top. Montos en S/. */
export async function generarExcelProductos(d: ReporteProductosDatos): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ropas';
  wb.created = new Date(d.generadoEn);

  construirResumen(wb, d);
  construirCatalogo(wb, 'Catálogo', d.productos);
  construirCatalogo(wb, 'Top stock', d.top);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function estiloHeader(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  for (let i = 1; i <= cols; i++) row.getCell(i).alignment = { vertical: 'middle' };
}

function construirResumen(wb: ExcelJS.Workbook, d: ReporteProductosDatos) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 24 }, { width: 14 }, { width: 16 }];

  ws.addRow(['REPORTE DE PRODUCTOS']).font = { bold: true, size: 16 };
  ws.addRow([d.tenantNombre]).font = { size: 11, color: { argb: 'FF555555' } };
  ws.addRow([`Snapshot al: ${fechaHora(d.generadoEn)} · montos en S/`]).font = { size: 9, color: { argb: 'FF999999' } };
  ws.addRow([]);

  const r = d.resumen;
  ws.addRow(['Totales']).font = { bold: true, size: 12 };
  const kpis: Array<[string, number, boolean?]> = [
    ['Productos', r.total],
    ['Activos', r.activos],
    ['Inactivos', r.inactivos],
    ['Variantes', r.variantes],
    ['Unidades en stock', r.unidadesStock],
    ['Valor a costo', r.valorCosto, true],
    ['Valor a venta', r.valorVenta, true],
    ['Sin precio de compra', r.sinPrecioCompra],
  ];
  for (const [label, valor, money] of kpis) {
    const row = ws.addRow([label, valor]);
    if (money) row.getCell(2).numFmt = MONEDA_FMT;
    if (label === 'Valor a costo') row.font = { bold: true };
  }
  ws.addRow([]);

  if (r.porCategoria.length) {
    ws.addRow(['Por categoría']).font = { bold: true, size: 12 };
    estiloHeader(ws.addRow(['Categoría', 'Productos', 'Valor costo']), 3);
    for (const c of r.porCategoria) ws.addRow([c.categoria, c.cantidad, c.valorCosto]).getCell(3).numFmt = MONEDA_FMT;
    ws.addRow([]);
  }
  if (r.porClasificacion.length) {
    ws.addRow(['Por clasificación ABC']).font = { bold: true, size: 12 };
    estiloHeader(ws.addRow(['Clase', 'Productos']), 2);
    for (const c of r.porClasificacion) ws.addRow([c.clasificacion, c.cantidad]);
  }
}

function construirCatalogo(wb: ExcelJS.Workbook, nombre: string, filas: FilaProductoCatalogo[]) {
  const ws = wb.addWorksheet(nombre);
  ws.columns = [
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Producto', key: 'nombre', width: 32 },
    { header: 'Categoría', key: 'categoria', width: 16 },
    { header: 'Marca', key: 'marca', width: 14 },
    { header: 'Género', key: 'genero', width: 10 },
    { header: 'Clase', key: 'clase', width: 8 },
    { header: 'P. venta', key: 'precioVenta', width: 12 },
    { header: 'P. compra', key: 'precioCompra', width: 12 },
    { header: 'Margen', key: 'margen', width: 9 },
    { header: 'Variantes', key: 'variantes', width: 10 },
    { header: 'Stock', key: 'stock', width: 8 },
    { header: 'Valor costo', key: 'valorCosto', width: 14 },
    { header: 'Valor venta', key: 'valorVenta', width: 14 },
    { header: 'Estado', key: 'estado', width: 10 },
  ];
  estiloHeader(ws.getRow(1), ws.columns.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of filas) {
    const row = ws.addRow({
      sku: p.sku, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, marca: p.marca,
      genero: p.genero, clase: p.clasificacion, precioVenta: p.precioVenta,
      precioCompra: p.precioCompra, margen: p.margenPct, variantes: p.variantes, stock: p.stock,
      valorCosto: p.valorCosto, valorVenta: p.valorVenta, estado: p.activo ? 'Activo' : 'Inactivo',
    });
    row.getCell('precioVenta').numFmt = MONEDA_FMT;
    if (p.precioCompra != null) row.getCell('precioCompra').numFmt = MONEDA_FMT;
    if (p.margenPct != null) row.getCell('margen').numFmt = PCT_FMT;
    row.getCell('valorCosto').numFmt = MONEDA_FMT;
    row.getCell('valorVenta').numFmt = MONEDA_FMT;
    if (!p.activo) row.font = { color: { argb: 'FF999999' } };
  }
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } };
}

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
