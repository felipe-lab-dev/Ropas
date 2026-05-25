import { CuponRenderService, CuponRenderData } from './cupon-render.service';

const dataBase: CuponRenderData = {
  codigo: 'TEST-XYZ12',
  nombre: 'Verano 2026 — 25% OFF',
  descripcion: 'Aplica en toda la tienda',
  tipoDescuento: 'porcentaje',
  valorDescuento: 25,
  fechaFin: new Date('2026-06-30T23:59:59Z'),
  montoMinimoCompra: 100,
  campania: 'Verano 2026',
  disenoColorPrimario: '#7c3aed',
  disenoColorSecundario: '#1e1b4b',
  disenoMensaje: 'Solo por 72 horas',
  disenoEmoji: '🔥',
  tienda: 'Mi Tienda',
};

describe('CuponRenderService', () => {
  const render = new CuponRenderService();

  describe('generarPdf', () => {
    it('produce un Buffer no vacío con magic bytes de PDF', async () => {
      const buffer = await render.generarPdf(dataBase);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);
      // PDF debe empezar con %PDF
      expect(buffer.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    it('funciona con monto fijo en lugar de porcentaje', async () => {
      const buffer = await render.generarPdf({
        ...dataBase,
        tipoDescuento: 'monto_fijo',
        valorDescuento: 50,
      });
      expect(buffer.length).toBeGreaterThan(500);
    });

    it('funciona sin campos opcionales', async () => {
      const buffer = await render.generarPdf({
        ...dataBase,
        descripcion: null,
        montoMinimoCompra: null,
        campania: null,
        disenoMensaje: null,
        disenoEmoji: null,
      });
      expect(buffer.length).toBeGreaterThan(500);
    });
  });

  describe('generarPng', () => {
    it('produce un Buffer no vacío con magic bytes de PNG', async () => {
      try {
        const buffer = await render.generarPng(dataBase);
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(1000);
        // PNG empieza con 89 50 4E 47
        expect(buffer.slice(0, 4).toString('hex')).toBe('89504e47');
      } catch (e: unknown) {
        // Si @napi-rs/canvas no se instaló (algunos sistemas), saltamos el test.
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('@napi-rs/canvas')) {
          console.warn('Saltando test PNG: @napi-rs/canvas no disponible en este entorno');
          return;
        }
        throw e;
      }
    });
  });
});
