import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

export interface CuponRenderData {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: number;
  fechaFin: Date;
  montoMinimoCompra?: number | null;
  campania?: string | null;
  disenoColorPrimario: string;
  disenoColorSecundario: string;
  disenoMensaje?: string | null;
  disenoEmoji?: string | null;
  tienda: string;
}

/**
 * Genera vouchers (PDF y PNG) con diseño profesional + QR.
 *
 *  - PDF: pdfkit. Carta vertical, recorta una tarjeta tipo voucher de 9x5cm.
 *  - PNG: render manual sobre Canvas (300x180 px) para WhatsApp / redes.
 *
 * El PNG usa @napi-rs/canvas que es portable en Windows/Linux/Mac y
 * no requiere libs C de sistema.
 */
@Injectable()
export class CuponRenderService {
  async generarPdf(data: CuponRenderData): Promise<Buffer> {
    const qrPng = await QRCode.toBuffer(`ROPAS-CUPON:${data.codigo}`, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 240,
      color: {
        dark: data.disenoColorSecundario.slice(0, 7),
        light: '#ffffff',
      },
    });

    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A6', margin: 0 });
      const chunks: Buffer[] = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const primario = data.disenoColorPrimario.slice(0, 7);
      const secundario = data.disenoColorSecundario.slice(0, 7);

      // Fondo gradient simulado con bandas
      doc.rect(0, 0, W, H).fill(secundario);
      doc.rect(0, 0, W, H * 0.4).fill(primario);

      // Header — tienda + campaña
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(data.tienda.toUpperCase(), 20, 20, { width: W - 40 });
      if (data.campania) {
        doc
          .fillColor('rgba(255,255,255,0.75)' as never)
          .font('Helvetica')
          .fontSize(8)
          .text(data.campania.toUpperCase(), 20, 36);
      }

      // Emoji decorativo
      if (data.disenoEmoji) {
        doc
          .fontSize(28)
          .fillColor('#ffffff')
          .text(data.disenoEmoji, W - 60, 18, { width: 40, align: 'right' });
      }

      // Valor del descuento (héroe)
      doc.fillColor('#ffffff').font('Helvetica-Bold');
      const valorTxt =
        data.tipoDescuento === 'porcentaje'
          ? `${data.valorDescuento}%`
          : `S/ ${data.valorDescuento.toFixed(0)}`;
      doc.fontSize(54).text(valorTxt, 20, 60, { width: W - 40 });
      doc.fontSize(10).text('DE DESCUENTO', 20, 120, { width: W - 40 });

      // Nombre del cupón
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(data.nombre, 20, 150, { width: W - 40 });

      // Mensaje
      if (data.disenoMensaje) {
        doc
          .fillColor('rgba(255,255,255,0.85)' as never)
          .font('Helvetica-Oblique')
          .fontSize(9)
          .text(data.disenoMensaje, 20, 175, { width: W - 40 });
      }

      // Línea separadora punteada
      const yLinea = H - 130;
      doc
        .strokeColor('rgba(255,255,255,0.3)' as never)
        .lineWidth(0.5)
        .dash(3, { space: 3 })
        .moveTo(20, yLinea)
        .lineTo(W - 20, yLinea)
        .stroke()
        .undash();

      // Código grande
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(data.codigo, 20, yLinea + 10, { width: W - 100, align: 'left' });

      // QR
      doc.image(qrPng, W - 90, yLinea + 5, { width: 70, height: 70 });

      // Footer condiciones
      const yCond = H - 50;
      doc
        .fillColor('rgba(255,255,255,0.7)' as never)
        .font('Helvetica')
        .fontSize(7);

      const lineas: string[] = [];
      lineas.push(`Vence: ${data.fechaFin.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}`);
      if (data.montoMinimoCompra) lineas.push(`Compra mínima: S/ ${data.montoMinimoCompra.toFixed(2)}`);
      if (data.descripcion) lineas.push(data.descripcion);
      doc.text(lineas.join('  •  '), 20, yCond, { width: W - 40 });

      // Tag de urgencia
      const diasRestantes = Math.ceil(
        (data.fechaFin.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (diasRestantes >= 0 && diasRestantes <= 7) {
        doc
          .fillColor('#fbbf24')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(
            diasRestantes === 0
              ? '⚠ VENCE HOY'
              : diasRestantes === 1
                ? '⚠ VENCE MAÑANA'
                : `⚠ Vence en ${diasRestantes} días`,
            20,
            yCond - 16,
            { width: W - 40 },
          );
      }

      doc.end();
    });
  }

  async generarPng(data: CuponRenderData): Promise<Buffer> {
    // Importación dinámica para que si no está instalado, el PDF siga funcionando.
    let canvas: typeof import('@napi-rs/canvas');
    try {
      canvas = await import('@napi-rs/canvas');
    } catch {
      throw new Error(
        'Para generar PNG instala la dependencia: pnpm --dir backend add @napi-rs/canvas',
      );
    }

    const W = 600;
    const H = 360;
    const c = canvas.createCanvas(W, H);
    const ctx = c.getContext('2d');
    const primario = data.disenoColorPrimario.slice(0, 7);
    const secundario = data.disenoColorSecundario.slice(0, 7);

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, primario);
    gradient.addColorStop(1, secundario);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Patrón decorativo (círculos translúcidos)
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(W - 60, 60, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, H - 30, 70, 0, Math.PI * 2);
    ctx.fill();

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(data.tienda.toUpperCase(), 32, 40);
    if (data.campania) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px sans-serif';
      ctx.fillText(data.campania.toUpperCase(), 32, 60);
    }

    // Emoji decorativo
    if (data.disenoEmoji) {
      ctx.font = '48px serif';
      ctx.fillText(data.disenoEmoji, W - 80, 60);
    }

    // Valor héroe
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px sans-serif';
    const valorTxt =
      data.tipoDescuento === 'porcentaje'
        ? `${data.valorDescuento}%`
        : `S/ ${data.valorDescuento.toFixed(0)}`;
    ctx.fillText(valorTxt, 32, 170);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('DE DESCUENTO', 32, 195);

    // Nombre cupón
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(truncar(data.nombre, 40), 32, 230);

    // Mensaje
    if (data.disenoMensaje) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'italic 13px sans-serif';
      ctx.fillText(truncar(data.disenoMensaje, 60), 32, 255);
    }

    // Línea separadora
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(32, 280);
    ctx.lineTo(W - 32, 280);
    ctx.stroke();
    ctx.setLineDash([]);

    // Código
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(data.codigo, 32, 320);

    // Condiciones
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px sans-serif';
    const cond = [
      `Vence: ${data.fechaFin.toLocaleDateString('es-PE')}`,
      data.montoMinimoCompra ? `Mín: S/ ${data.montoMinimoCompra.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join('   •   ');
    ctx.fillText(cond, 32, 345);

    // QR
    const qrPng = await QRCode.toBuffer(`ROPAS-CUPON:${data.codigo}`, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 110,
      color: { dark: '#ffffff', light: '#00000000' },
    });
    const qrImg = await canvas.loadImage(qrPng);
    ctx.drawImage(qrImg, W - 130, H - 130, 100, 100);

    return c.toBuffer('image/png');
  }
}

function truncar(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
