/**
 * Tests del CpeCalculadoraService — strict TDD.
 *
 * Convención de asserts monetarios:
 *   result.campo.toFixed(2) === 'NNN.NN'
 *
 * porcentajeIgv es number (no Decimal) → toBe(18) / toBe(0).
 */
import { CpeCalculadoraService } from './cpe-calculadora.service';
import { VentaParaCalcular } from './types';

describe('CpeCalculadoraService', () => {
  const servicio = new CpeCalculadoraService();

  // ─── Caso 1: 1 ítem gravado_onerosa, cantidad 1, precio 590 ─────────────────

  describe('1 ítem gravado, cant 1, precio 590', () => {
    it('calcula precioSinIgv, valorVentaItem, montoIgvItem, montoTotal correctamente', () => {
      const venta: VentaParaCalcular = {
        items: [
          {
            codigo: 'P-001',
            descripcion: 'Producto 1',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: 590,
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
      };

      const resultado = servicio.calcular(venta);
      const item = resultado.items[0]!;

      expect(item.precioSinIgv.toFixed(2)).toBe('500.00');
      expect(item.valorVentaItem.toFixed(2)).toBe('500.00');
      expect(item.montoIgvItem.toFixed(2)).toBe('90.00');
      expect(item.montoPrecioVentaItem.toFixed(2)).toBe('590.00');
      expect(item.porcentajeIgv).toBe(18);
      expect(resultado.montoTotal.toFixed(2)).toBe('590.00');
      expect(resultado.montoTotalGravado.toFixed(2)).toBe('500.00');
      expect(resultado.montoTotalIgv.toFixed(2)).toBe('90.00');
    });
  });

  // ─── Caso 2: 1 ítem gravado_onerosa, cantidad 2, precio 590 ─────────────────

  describe('1 ítem gravado, cant 2, precio 590', () => {
    it('matchea el golden de la factura tradicional (1000/180/1180)', () => {
      const venta: VentaParaCalcular = {
        items: [
          {
            codigo: 'P-001',
            descripcion: 'Producto 1',
            unidadMedida: 'NIU',
            cantidad: 2,
            precioUnitarioConIgv: 590,
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
      };

      const resultado = servicio.calcular(venta);
      const item = resultado.items[0]!;

      expect(item.valorVentaItem.toFixed(2)).toBe('1000.00');
      expect(item.montoIgvItem.toFixed(2)).toBe('180.00');
      expect(item.montoPrecioVentaItem.toFixed(2)).toBe('1180.00');
      expect(resultado.montoTotalGravado.toFixed(2)).toBe('1000.00');
      expect(resultado.montoTotalIgv.toFixed(2)).toBe('180.00');
      expect(resultado.montoTotal.toFixed(2)).toBe('1180.00');
    });
  });

  // ─── Caso 3: 2 ítems gravado_onerosa, cantidad 1 c/u, precio 590 ─────────────

  describe('2 ítems gravados, cant 1 c/u, precio 590', () => {
    it('matchea el golden de la factura tradicional (montoTotalGravado=1000, igv=180, total=1180)', () => {
      const venta: VentaParaCalcular = {
        items: [
          {
            codigo: 'P-001',
            descripcion: 'Producto 1',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: 590,
            tipoAfectacionIgv: 'gravado_onerosa',
          },
          {
            codigo: 'P-002',
            descripcion: 'Producto 2',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: 590,
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
      };

      const resultado = servicio.calcular(venta);

      expect(resultado.montoTotalGravado.toFixed(2)).toBe('1000.00');
      expect(resultado.montoTotalIgv.toFixed(2)).toBe('180.00');
      expect(resultado.montoTotal.toFixed(2)).toBe('1180.00');
      expect(resultado.montoTotalExonerado.toFixed(2)).toBe('0.00');
      expect(resultado.montoTotalInafecto.toFixed(2)).toBe('0.00');
    });
  });

  // ─── Caso 4: 1 ítem exonerado_onerosa, cantidad 1, precio 100 ────────────────

  describe('1 ítem exonerado, cant 1, precio 100', () => {
    it('porcentajeIgv=0, igv=0, va a montoTotalExonerado', () => {
      const venta: VentaParaCalcular = {
        items: [
          {
            codigo: 'P-EXO',
            descripcion: 'Producto exonerado',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: 100,
            tipoAfectacionIgv: 'exonerado_onerosa',
          },
        ],
      };

      const resultado = servicio.calcular(venta);
      const item = resultado.items[0]!;

      expect(item.precioSinIgv.toFixed(2)).toBe('100.00');
      expect(item.valorVentaItem.toFixed(2)).toBe('100.00');
      expect(item.montoIgvItem.toFixed(2)).toBe('0.00');
      expect(item.porcentajeIgv).toBe(0);
      expect(resultado.montoTotalExonerado.toFixed(2)).toBe('100.00');
      expect(resultado.montoTotalGravado.toFixed(2)).toBe('0.00');
      expect(resultado.montoTotalIgv.toFixed(2)).toBe('0.00');
      expect(resultado.montoTotal.toFixed(2)).toBe('100.00');
    });
  });

  // ─── Caso 5: mix gravado (118, cant 1) + exonerado (50, cant 2) ───────────────

  describe('mix: 1 ítem gravado (precio 118, cant 1) + 1 ítem exonerado (precio 50, cant 2)', () => {
    it('calcula correctamente por categoría y el total general', () => {
      const venta: VentaParaCalcular = {
        items: [
          {
            codigo: 'P-GRV',
            descripcion: 'Gravado',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: 118,
            tipoAfectacionIgv: 'gravado_onerosa',
          },
          {
            codigo: 'P-EXO',
            descripcion: 'Exonerado',
            unidadMedida: 'NIU',
            cantidad: 2,
            precioUnitarioConIgv: 50,
            tipoAfectacionIgv: 'exonerado_onerosa',
          },
        ],
      };

      const resultado = servicio.calcular(venta);
      const itemGravado = resultado.items[0]!;
      const itemExonerado = resultado.items[1]!;

      // Ítem gravado
      expect(itemGravado.precioSinIgv.toFixed(2)).toBe('100.00');
      expect(itemGravado.valorVentaItem.toFixed(2)).toBe('100.00');
      expect(itemGravado.montoIgvItem.toFixed(2)).toBe('18.00');

      // Ítem exonerado
      expect(itemExonerado.precioSinIgv.toFixed(2)).toBe('50.00');
      expect(itemExonerado.valorVentaItem.toFixed(2)).toBe('100.00'); // 50 × 2
      expect(itemExonerado.montoIgvItem.toFixed(2)).toBe('0.00');

      // Cabecera
      expect(resultado.montoTotalGravado.toFixed(2)).toBe('100.00');
      expect(resultado.montoTotalExonerado.toFixed(2)).toBe('100.00');
      expect(resultado.montoTotalIgv.toFixed(2)).toBe('18.00');
      expect(resultado.montoTotal.toFixed(2)).toBe('218.00');
    });
  });

  // ─── Caso 6: redondeo ROUND_HALF_EVEN — precio 100, cant 1 ───────────────────
  // 100 / 1.18 = 84.745762711... → ROUND_HALF_EVEN → 84.75
  // valorVentaItem = 84.75 × 1 = 84.75
  // montoIgvItem = 100.00 - 84.75 = 15.25

  describe('redondeo Banker (ROUND_HALF_EVEN): precio 100, cant 1', () => {
    it('precioSinIgv=84.75, valorVentaItem=84.75, montoIgvItem=15.25, montoTotal=100.00', () => {
      const venta: VentaParaCalcular = {
        items: [
          {
            codigo: 'P-RDN',
            descripcion: 'Redondeo',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: 100,
            tipoAfectacionIgv: 'gravado_onerosa',
          },
        ],
      };

      const resultado = servicio.calcular(venta);
      const item = resultado.items[0]!;

      expect(item.precioSinIgv.toFixed(2)).toBe('84.75');
      expect(item.valorVentaItem.toFixed(2)).toBe('84.75');
      expect(item.montoIgvItem.toFixed(2)).toBe('15.25');
      expect(resultado.montoTotal.toFixed(2)).toBe('100.00');
    });
  });

  // ─── Caso 7: inafecto + exportacion → ambos van a montoTotalInafecto ──────────

  describe('inafecto_onerosa + exportacion: ambos van a montoTotalInafecto', () => {
    it('montoTotalInafecto acumula ambas categorías, gravado y exonerado = 0', () => {
      const venta: VentaParaCalcular = {
        items: [
          {
            codigo: 'P-INA',
            descripcion: 'Inafecto onerosa',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: 50,
            tipoAfectacionIgv: 'inafecto_onerosa',
          },
          {
            codigo: 'P-EXP',
            descripcion: 'Exportación',
            unidadMedida: 'NIU',
            cantidad: 1,
            precioUnitarioConIgv: 50,
            tipoAfectacionIgv: 'exportacion',
          },
        ],
      };

      const resultado = servicio.calcular(venta);
      const itemInafecto = resultado.items[0]!;
      const itemExportacion = resultado.items[1]!;

      expect(itemInafecto.porcentajeIgv).toBe(0);
      expect(itemInafecto.montoIgvItem.toFixed(2)).toBe('0.00');
      expect(itemExportacion.porcentajeIgv).toBe(0);
      expect(itemExportacion.montoIgvItem.toFixed(2)).toBe('0.00');

      expect(resultado.montoTotalInafecto.toFixed(2)).toBe('100.00');
      expect(resultado.montoTotalGravado.toFixed(2)).toBe('0.00');
      expect(resultado.montoTotalExonerado.toFixed(2)).toBe('0.00');
      expect(resultado.montoTotalIgv.toFixed(2)).toBe('0.00');
      expect(resultado.montoTotal.toFixed(2)).toBe('100.00');
    });
  });
});
