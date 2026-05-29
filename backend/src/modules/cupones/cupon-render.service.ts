import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
  /** URL pública (Azure Blob) de imagen de fondo personalizada (opcional). */
  fondoImagenUrl?: string | null;
  /** ID del tema estacional predefinido (opcional). Aplica overlay/colores temáticos. */
  temaEstacional?: string | null;
}

/**
 * Cadena de fuentes con fallback robusto. La primera disponible gana.
 * Arial existe en Windows; DejaVu/Liberation en Linux con `fonts-liberation`
 * instalado en el container.
 */
const FONT_STACK_REGULAR = '"Arial", "Liberation Sans", "DejaVu Sans", "Helvetica", sans-serif';
const FONT_STACK_BOLD = '"Arial Bold", "Arial", "Liberation Sans", "DejaVu Sans", "Helvetica", sans-serif';
const FONT_STACK_MONO = '"Consolas", "Liberation Mono", "DejaVu Sans Mono", "Menlo", monospace';
const FONT_STACK_SERIF = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", serif';

/**
 * Genera vouchers (PDF y PNG) con diseño profesional + QR.
 *
 *  - PDF: pdfkit (fuentes Helvetica built-in).
 *  - PNG: @napi-rs/canvas, con fuentes del sistema cargadas en OnModuleInit.
 *    En Windows usa Arial; en Linux container requiere `fonts-liberation`
 *    (instalable con `apt-get install fonts-liberation`).
 *
 * Si `loadSystemFonts()` no carga ninguna fuente, el `fillText` renderiza
 * VACÍO (texto invisible) — por eso al iniciar verificamos y logueamos
 * advertencia.
 */
@Injectable()
export class CuponRenderService implements OnModuleInit {
  private readonly logger = new Logger(CuponRenderService.name);
  private fuentesCargadas = false;

  async onModuleInit() {
    try {
      const canvas = await import('@napi-rs/canvas');
      const fs = await import('node:fs');

      // @napi-rs/canvas no auto-carga fuentes del sistema — hay que registrar
      // explícitamente. Probamos paths conocidos por plataforma. Si NINGUNA
      // se registra, el PNG sale sin texto (caso prod sin fonts-liberation).
      const candidatos: Array<{ path: string; alias: string }> = [
        // Windows
        { path: 'C:/Windows/Fonts/arial.ttf', alias: 'Arial' },
        { path: 'C:/Windows/Fonts/arialbd.ttf', alias: 'Arial Bold' },
        { path: 'C:/Windows/Fonts/ariali.ttf', alias: 'Arial Italic' },
        { path: 'C:/Windows/Fonts/consola.ttf', alias: 'Consolas' },
        { path: 'C:/Windows/Fonts/consolab.ttf', alias: 'Consolas Bold' },
        { path: 'C:/Windows/Fonts/seguiemj.ttf', alias: 'Segoe UI Emoji' },
        // Linux (apt install fonts-liberation fonts-noto-color-emoji)
        { path: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', alias: 'Arial' },
        { path: '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', alias: 'Arial Bold' },
        { path: '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf', alias: 'Arial Italic' },
        { path: '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf', alias: 'Consolas' },
        { path: '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf', alias: 'Consolas Bold' },
        { path: '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', alias: 'Segoe UI Emoji' },
        // Mac (fallback raro pero por completitud)
        { path: '/Library/Fonts/Arial.ttf', alias: 'Arial' },
        { path: '/System/Library/Fonts/Helvetica.ttc', alias: 'Arial' },
      ];

      let registradas = 0;
      for (const { path, alias } of candidatos) {
        if (!fs.existsSync(path)) continue;
        try {
          const key = canvas.GlobalFonts.registerFromPath(path, alias);
          if (key) registradas++;
        } catch {
          /* fuente corrupta, skip */
        }
      }

      this.fuentesCargadas = registradas > 0;
      if (this.fuentesCargadas) {
        this.logger.log(`Cupones: ${registradas} fuente(s) registrada(s)`);
      } else {
        this.logger.warn(
          'Cupones: NO se cargaron fuentes. El PNG saldrá sin texto. ' +
            'Linux container: instala `fonts-liberation fonts-noto-color-emoji`.',
        );
      }
    } catch (e) {
      this.logger.warn(`@napi-rs/canvas no disponible: ${(e as Error).message}`);
    }
  }

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

    // Descargar fondo personalizado en paralelo al QR (si aplica)
    let fondoBuffer: Buffer | null = null;
    if (data.fondoImagenUrl) {
      fondoBuffer = await descargarImagen(data.fondoImagenUrl).catch(() => null);
    }

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

      // Fondo: imagen personalizada con overlay, o gradient simulado con bandas
      if (fondoBuffer) {
        try {
          doc.image(fondoBuffer, 0, 0, { width: W, height: H, cover: [W, H] as never });
          // Overlay oscuro para legibilidad del texto blanco
          doc.fillOpacity(0.7).rect(0, 0, W, H).fill(secundario);
          doc.fillOpacity(1);
        } catch {
          doc.rect(0, 0, W, H).fill(secundario);
          doc.rect(0, 0, W, H * 0.4).fill(primario);
        }
      } else {
        doc.rect(0, 0, W, H).fill(secundario);
        doc.rect(0, 0, W, H * 0.4).fill(primario);
      }

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

    // ── FONDO ─────────────────────────────────────────────────────────
    // Si hay imagen personalizada, la dibujamos full-bleed. Si falla la
    // descarga (URL caída), caemos al gradient de colores como respaldo.
    let fondoDibujado = false;
    if (data.fondoImagenUrl) {
      try {
        const bgBuffer = await descargarImagen(data.fondoImagenUrl);
        if (bgBuffer) {
          const bgImg = await canvas.loadImage(bgBuffer);
          // Cover-fit: escala manteniendo proporción
          const scale = Math.max(W / bgImg.width, H / bgImg.height);
          const dw = bgImg.width * scale;
          const dh = bgImg.height * scale;
          const dx = (W - dw) / 2;
          const dy = (H - dh) / 2;
          ctx.drawImage(bgImg, dx, dy, dw, dh);
          // Overlay oscuro para mantener legibilidad del texto
          const overlay = ctx.createLinearGradient(0, 0, 0, H);
          overlay.addColorStop(0, `${secundario}cc`); // ~80% opacity
          overlay.addColorStop(1, `${primario}b3`); // ~70% opacity
          ctx.fillStyle = overlay;
          ctx.fillRect(0, 0, W, H);
          fondoDibujado = true;
        }
      } catch (e) {
        this.logger.warn(
          `No se pudo cargar imagen de fondo, usando gradient. ${(e as Error).message}`,
        );
      }
    }

    if (!fondoDibujado) {
      // Background gradient (default)
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
    }

    // ── TEXTO ─────────────────────────────────────────────────────────
    // Si no hay fuentes cargadas, evitamos perder el voucher mostrando
    // un mensaje de fallback como text-shadow para verificar visualmente.
    if (!this.fuentesCargadas) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(0, 0, W, 6); // banda superior visible como signal
    }

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 18px ${FONT_STACK_BOLD}`;
    ctx.fillText(data.tienda.toUpperCase(), 32, 40);
    if (data.campania) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `12px ${FONT_STACK_REGULAR}`;
      ctx.fillText(data.campania.toUpperCase(), 32, 60);
    }

    // Emoji decorativo
    if (data.disenoEmoji) {
      ctx.font = `48px ${FONT_STACK_SERIF}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(data.disenoEmoji, W - 80, 70);
    }

    // Valor héroe
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 96px ${FONT_STACK_BOLD}`;
    const valorTxt =
      data.tipoDescuento === 'porcentaje'
        ? `${data.valorDescuento}%`
        : `S/ ${data.valorDescuento.toFixed(0)}`;
    ctx.fillText(valorTxt, 32, 170);

    ctx.font = `bold 14px ${FONT_STACK_BOLD}`;
    ctx.fillText('DE DESCUENTO', 32, 195);

    // Nombre cupón
    ctx.font = `bold 20px ${FONT_STACK_BOLD}`;
    ctx.fillText(truncar(data.nombre, 40), 32, 230);

    // Mensaje
    if (data.disenoMensaje) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `italic 13px ${FONT_STACK_REGULAR}`;
      ctx.fillText(truncar(data.disenoMensaje, 60), 32, 255);
    }

    // Línea separadora
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(32, 280);
    ctx.lineTo(W - 32, 280);
    ctx.stroke();
    ctx.setLineDash([]);

    // Código (mono)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 28px ${FONT_STACK_MONO}`;
    ctx.fillText(data.codigo, 32, 320);

    // Condiciones
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `11px ${FONT_STACK_REGULAR}`;
    const cond = [
      `Vence: ${data.fechaFin.toLocaleDateString('es-PE')}`,
      data.montoMinimoCompra ? `Mín: S/ ${data.montoMinimoCompra.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join('   •   ');
    ctx.fillText(cond, 32, 345);

    // QR — fondo blanco para que sea escaneable encima de cualquier color
    const qrPng = await QRCode.toBuffer(`ROPAS-CUPON:${data.codigo}`, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 110,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    const qrImg = await canvas.loadImage(qrPng);
    // Caja blanca redondeada detrás del QR para mejor contraste sobre fotos
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, W - 134, H - 134, 108, 108, 8);
    ctx.fill();
    ctx.drawImage(qrImg, W - 130, H - 130, 100, 100);

    return c.toBuffer('image/png');
  }
}

function truncar(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function roundRect(
  ctx: import('@napi-rs/canvas').SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Descarga una imagen pública (Azure Blob) y la devuelve como Buffer.
 * Timeout de 5s para no colgar el render si el blob está lento.
 */
async function descargarImagen(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } finally {
    clearTimeout(t);
  }
}
