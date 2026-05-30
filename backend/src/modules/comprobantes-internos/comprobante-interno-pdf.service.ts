import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { montoEnLetras } from './monto-en-letras';

/** Datos del emisor (tomados de ConfiguracionFacturacion si el tenant la tiene). */
export interface DatosEmisor {
  ruc?: string | null;
  razonSocial?: string | null;
  nombreComercial?: string | null;
  direccionFiscal?: string | null;
}

/** Una línea de la tabla de ítems del comprobante interno. */
export interface LineaComprobante {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  /** Unidad de medida SUNAT. Por defecto NIU (unidad). */
  unidadMedida?: string;
}

/** Campos comunes a la nota de venta y a la nota de crédito interna. */
export interface DatosComprobanteBase {
  emisor?: DatosEmisor | null;
  /** Nombre legible del tenant/tienda (ctx.nombre) — fallback si no hay razón social. */
  tienda: string;
  sucursalNombre?: string | null;
  sucursalDireccion?: string | null;
  /** Número interno del documento (ej. V-000090 / NC-000045). */
  numero: string;
  fecha: Date;
  /** Código ISO de la moneda original ("PEN" | "USD"). */
  moneda: string;
  clienteNombre?: string | null;
  /** Documento del cliente ya formateado (ej. "DNI 70498300"). */
  clienteDocumento?: string | null;
  items: LineaComprobante[];
  subtotal: number;
  descuento?: number;
  /** IGV ya calculado; si es 0/omitido se deriva del total (precio incluye IGV). */
  impuestos?: number;
  total: number;
}

export interface DatosPdfVenta extends DatosComprobanteBase {
  vendedorNombre?: string | null;
  estado: string;
  notas?: string | null;
  pagos?: { medio: string; monto: number }[];
}

export interface DatosPdfNotaCredito extends DatosComprobanteBase {
  motivo: string;
  ventaOriginalNumero?: string | null;
  emitidaPorNombre?: string | null;
}

// ─── Geometría (A4, en puntos) ─────────────────────────────────────────────
const MARGEN = 40;
const ANCHO = 595.28;
const X0 = MARGEN;
const X1 = ANCHO - MARGEN; // 555.28
const ANCHO_UTIL = X1 - X0;

// Columnas de la tabla de ítems
const C_CANT = X0;
const C_UM = X0 + 48;
const C_DESC = X0 + 96;
const C_PUNIT = 398;
const C_IMP = 470;
const ANCHO_DESC = C_PUNIT - C_DESC - 8;

// Paleta
const TINTA = '#0f172a';
const SUAVE = '#64748b';
const LINEA = '#cbd5e1';
const BANDA = '#1e293b';
const CEBRA = '#f1f5f9';
const IGV_TASA = 0.18;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Genera comprobantes internos en PDF (A4) con la estructura visual de una
 * boleta electrónica peruana: bloque de emisor, recuadro de RUC + tipo y número
 * de documento, datos del cliente, tabla de ítems con unidad de medida, desglose
 * Op. Gravada / IGV / Importe Total y el monto en letras.
 *
 * Cubre la "nota de venta" (venta que NO va a SUNAT) y su devolución/NC interna.
 * Conserva el sello "SIN VALIDEZ TRIBUTARIA" porque NO es un comprobante
 * electrónico — para eso ya existe el PDF de MiFact.
 *
 * Usa pdfkit con fuentes Helvetica built-in (no requiere registrar fuentes del
 * sistema, a diferencia del render de cupones con canvas).
 */
@Injectable()
export class ComprobanteInternoPdfService {
  generarPdfVenta(data: DatosPdfVenta): Promise<Buffer> {
    return this.render(doc => {
      let y = this.cabecera(doc, data, 'NOTA DE VENTA');
      y = this.bloqueInfo(doc, data, y, [
        data.vendedorNombre ? { etiqueta: 'Vendedor', valor: data.vendedorNombre } : null,
        { etiqueta: 'Estado', valor: this.capitalizar(data.estado) },
      ]);
      y = this.tablaItems(doc, data.items, data.moneda, y);
      y = this.totales(doc, data, y);

      const lineas: string[] = [];
      if (data.pagos && data.pagos.length > 0) {
        lineas.push(
          'Forma de pago: ' +
            data.pagos
              .map(p => `${this.capitalizar(p.medio.replace(/_/g, ' '))} ${this.monto(p.monto, data.moneda)}`)
              .join('  ·  '),
        );
      }
      if (data.notas) lineas.push(`Observaciones: ${data.notas}`);
      this.pie(doc, y, lineas);
    });
  }

  generarPdfNotaCredito(data: DatosPdfNotaCredito): Promise<Buffer> {
    return this.render(doc => {
      let y = this.cabecera(doc, data, 'NOTA DE CRÉDITO');
      y = this.bloqueInfo(doc, data, y, [
        data.ventaOriginalNumero
          ? { etiqueta: 'Doc. afectado', valor: data.ventaOriginalNumero }
          : null,
        data.emitidaPorNombre ? { etiqueta: 'Emitida por', valor: data.emitidaPorNombre } : null,
      ]);
      y = this.tablaItems(doc, data.items, data.moneda, y);
      y = this.totales(doc, data, y);
      this.pie(doc, y, [`Motivo: ${data.motivo}`]);
    });
  }

  // ─── Composición ──────────────────────────────────────────────────────────

  private render(dibujar: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: MARGEN });
      const chunks: Buffer[] = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      dibujar(doc);
      doc.end();
    });
  }

  /** Bloque de emisor (izq.) + recuadro RUC/tipo/número (der.) + banda de sello. */
  private cabecera(doc: PDFKit.PDFDocument, data: DatosComprobanteBase, titulo: string): number {
    const emisor = data.emisor;
    const nombreEmisor = emisor?.razonSocial?.trim() || data.tienda;

    // ── Emisor (izquierda)
    doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(15).text(nombreEmisor, X0, MARGEN, {
      width: 300,
    });
    let yE = doc.y + 1;
    doc.font('Helvetica').fontSize(8.5).fillColor(SUAVE);
    if (emisor?.nombreComercial && emisor.nombreComercial.trim() !== nombreEmisor) {
      doc.text(emisor.nombreComercial, X0, yE, { width: 300 });
      yE = doc.y;
    }
    if (emisor?.direccionFiscal) {
      doc.text(emisor.direccionFiscal, X0, yE, { width: 300 });
      yE = doc.y;
    }
    const sucursal = [data.sucursalNombre, data.sucursalDireccion].filter(Boolean).join(' · ');
    if (sucursal) {
      doc.text(sucursal, X0, yE, { width: 300 });
      yE = doc.y;
    }

    // ── Recuadro RUC + tipo + número (derecha)
    const bx = 360;
    const bw = X1 - bx;
    const bh = 70;
    doc.lineWidth(1).strokeColor(TINTA).roundedRect(bx, MARGEN, bw, bh, 6).stroke();
    if (emisor?.ruc) {
      doc
        .fillColor(TINTA)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(`R.U.C. ${emisor.ruc}`, bx, MARGEN + 9, { width: bw, align: 'center' });
    }
    doc
      .fillColor(TINTA)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(titulo, bx, MARGEN + (emisor?.ruc ? 28 : 18), { width: bw, align: 'center' });
    doc
      .fillColor(SUAVE)
      .font('Helvetica')
      .fontSize(11)
      .text(data.numero, bx, MARGEN + (emisor?.ruc ? 47 : 40), { width: bw, align: 'center' });

    // Línea separadora bajo la cabecera
    const yLinea = Math.max(yE, MARGEN + bh) + 12;
    doc.lineWidth(0.75).strokeColor(LINEA).moveTo(X0, yLinea).lineTo(X1, yLinea).stroke();
    return yLinea + 14;
  }

  /** Recuadro con datos de cliente, fecha, moneda y pares extra (vendedor, estado…). */
  private bloqueInfo(
    doc: PDFKit.PDFDocument,
    data: DatosComprobanteBase,
    yInicio: number,
    extras: ({ etiqueta: string; valor: string } | null)[],
  ): number {
    const filas: { etiqueta: string; valor: string }[] = [
      { etiqueta: 'Cliente', valor: data.clienteNombre || 'Cliente no registrado' },
      { etiqueta: 'Documento', valor: data.clienteDocumento || '—' },
      { etiqueta: 'Fecha emisión', valor: this.fechaLarga(data.fecha) },
      { etiqueta: 'Moneda', valor: this.nombreMoneda(data.moneda) },
      ...(extras.filter(Boolean) as { etiqueta: string; valor: string }[]),
    ];

    const colW = ANCHO_UTIL / 2;
    const filasPorCol = Math.ceil(filas.length / 2);
    const altoFila = 15;
    const padY = 8;
    const y0 = yInicio;
    const alto = filasPorCol * altoFila + padY * 2;

    doc.lineWidth(0.75).strokeColor(LINEA).roundedRect(X0, y0, ANCHO_UTIL, alto, 5).stroke();

    filas.forEach((f, i) => {
      const col = Math.floor(i / filasPorCol);
      const fila = i % filasPorCol;
      const x = X0 + 10 + col * colW;
      const y = y0 + padY + fila * altoFila;
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(SUAVE)
        .text(`${f.etiqueta}:`, x, y, { width: 78, continued: false });
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(TINTA)
        .text(f.valor, x + 80, y, { width: colW - 100, ellipsis: true, lineBreak: false });
    });

    return y0 + alto + 12;
  }

  private tablaItems(
    doc: PDFKit.PDFDocument,
    items: LineaComprobante[],
    moneda: string,
    yInicio: number,
  ): number {
    let y = yInicio;

    // Encabezado
    doc.rect(X0, y, ANCHO_UTIL, 20).fill(BANDA);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
    doc.text('Cant.', C_CANT + 4, y + 6, { width: C_UM - C_CANT - 6, align: 'left' });
    doc.text('U.M.', C_UM, y + 6, { width: C_DESC - C_UM - 6, align: 'left' });
    doc.text('Descripción', C_DESC, y + 6, { width: ANCHO_DESC });
    doc.text('P. Unit.', C_PUNIT, y + 6, { width: C_IMP - C_PUNIT - 6, align: 'right' });
    doc.text('Importe', C_IMP, y + 6, { width: X1 - C_IMP - 6, align: 'right' });
    y += 20;

    // Filas
    doc.font('Helvetica').fontSize(8.5);
    for (const [i, it] of items.entries()) {
      const alto = Math.max(18, doc.heightOfString(it.descripcion, { width: ANCHO_DESC }) + 8);
      if (i % 2 === 1) doc.rect(X0, y, ANCHO_UTIL, alto).fill(CEBRA);
      doc.fillColor(TINTA).font('Helvetica');
      doc.text(this.numero(it.cantidad), C_CANT + 4, y + 5, { width: C_UM - C_CANT - 6 });
      doc.text(it.unidadMedida || 'NIU', C_UM, y + 5, { width: C_DESC - C_UM - 6 });
      doc.text(it.descripcion, C_DESC, y + 5, { width: ANCHO_DESC });
      doc.text(this.monto(it.precioUnitario, moneda), C_PUNIT, y + 5, {
        width: C_IMP - C_PUNIT - 6,
        align: 'right',
      });
      doc.text(this.monto(it.subtotal, moneda), C_IMP, y + 5, {
        width: X1 - C_IMP - 6,
        align: 'right',
      });
      y += alto;
    }

    doc.lineWidth(0.75).strokeColor(LINEA).moveTo(X0, y).lineTo(X1, y).stroke();
    return y + 12;
  }

  /** Monto en letras (izq.) + caja de totales con desglose IGV (der.). */
  private totales(doc: PDFKit.PDFDocument, data: DatosComprobanteBase, yInicio: number): number {
    const igv =
      data.impuestos && data.impuestos > 0 ? r2(data.impuestos) : r2(data.total - data.total / (1 + IGV_TASA));
    const opGravada = r2(data.total - igv);
    const descuento = data.descuento && data.descuento > 0 ? r2(data.descuento) : 0;

    // Caja de totales (derecha)
    const tx = 350;
    const tw = X1 - tx;
    let y = yInicio;
    const fila = (etiqueta: string, valor: string, fuerte = false) => {
      doc
        .font(fuerte ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fuerte ? 11 : 9)
        .fillColor(fuerte ? TINTA : SUAVE)
        .text(etiqueta, tx, y + (fuerte ? 3 : 0), { width: tw * 0.5, align: 'left' });
      doc
        .font('Helvetica-Bold')
        .fontSize(fuerte ? 11 : 9)
        .fillColor(TINTA)
        .text(valor, tx + tw * 0.4, y + (fuerte ? 3 : 0), {
          width: tw * 0.6 - 6,
          align: 'right',
        });
      y += fuerte ? 22 : 15;
    };

    if (descuento > 0) fila('Descuento', `- ${this.monto(descuento, data.moneda)}`);
    fila('Op. Gravada', this.monto(opGravada, data.moneda));
    fila('I.G.V. (18%)', this.monto(igv, data.moneda));
    // Línea separadora antes del total
    doc.lineWidth(0.75).strokeColor(LINEA).moveTo(tx, y - 2).lineTo(X1, y - 2).stroke();
    y += 3;
    fila('IMPORTE TOTAL', this.monto(data.total, data.moneda), true);

    // Monto en letras (izquierda)
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(TINTA)
      .text(montoEnLetras(data.total, data.moneda), X0, yInicio, { width: tx - X0 - 16 });

    return Math.max(y, yInicio + 50) + 8;
  }

  private pie(doc: PDFKit.PDFDocument, yInicio: number, lineas: string[]): number {
    let y = yInicio;
    if (lineas.length > 0) {
      doc.lineWidth(0.5).strokeColor(LINEA).moveTo(X0, y).lineTo(X1, y).stroke();
      y += 8;
      doc.font('Helvetica').fontSize(8.5).fillColor(TINTA);
      for (const l of lineas) {
        doc.text(l, X0, y, { width: ANCHO_UTIL });
        y = this.cursorY(doc) + 4;
      }
    }
    return y;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private cursorY(doc: PDFKit.PDFDocument): number {
    return doc.y;
  }

  private monto(n: number, moneda: string): string {
    const simbolo = moneda === 'USD' ? 'US$' : 'S/';
    return `${simbolo} ${n.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private numero(n: number): string {
    return n.toLocaleString('es-PE', { maximumFractionDigits: 3 });
  }

  private nombreMoneda(moneda: string): string {
    return moneda === 'USD' ? 'Dólares americanos' : 'Soles';
  }

  private fechaLarga(fecha: Date): string {
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private capitalizar(s: string): string {
    return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
}
