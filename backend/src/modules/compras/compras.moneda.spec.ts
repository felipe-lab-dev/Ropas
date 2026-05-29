import { ErrorValidacion } from '../../core/errors/errores';
import { aPEN, costoUnitarioPEN, round4, normalizarMoneda } from './compras.moneda';

describe('compras.moneda', () => {
  describe('aPEN', () => {
    it('multiplica por el TC y redondea a 2 decimales', () => {
      expect(aPEN(59, 3.75)).toBe(221.25);
      expect(aPEN(10, 1)).toBe(10);
    });
    it('redondea sin acumular error', () => {
      expect(aPEN(33.333, 3)).toBe(100); // 99.999 → 100.00
    });
  });

  describe('costoUnitarioPEN', () => {
    it('convierte con 4 decimales de precisión', () => {
      expect(costoUnitarioPEN(10, 3.756)).toBe(37.56);
      expect(costoUnitarioPEN(1.2345, 1)).toBe(1.2345);
    });
  });

  describe('round4', () => {
    it('redondea a 4 decimales', () => {
      expect(round4(1.234567)).toBe(1.2346);
    });
  });

  describe('normalizarMoneda', () => {
    it('PEN fuerza tipoCambio=1 ignorando lo recibido', () => {
      expect(normalizarMoneda({ moneda: 'PEN', tipoCambio: 99 })).toEqual({
        moneda: 'PEN',
        tipoCambio: 1,
      });
    });
    it('sin moneda → PEN con tipoCambio=1', () => {
      expect(normalizarMoneda({})).toEqual({ moneda: 'PEN', tipoCambio: 1 });
    });
    it('USD exige tipoCambio > 0', () => {
      expect(() => normalizarMoneda({ moneda: 'USD' })).toThrow(ErrorValidacion);
      expect(() => normalizarMoneda({ moneda: 'USD', tipoCambio: 0 })).toThrow(
        ErrorValidacion,
      );
      expect(normalizarMoneda({ moneda: 'USD', tipoCambio: 3.8 })).toEqual({
        moneda: 'USD',
        tipoCambio: 3.8,
      });
    });
    it('normaliza a mayúsculas y rechaza moneda fuera de la whitelist', () => {
      expect(normalizarMoneda({ moneda: 'usd', tipoCambio: 3.8 }).moneda).toBe('USD');
      expect(() => normalizarMoneda({ moneda: 'EUR', tipoCambio: 4 })).toThrow(
        ErrorValidacion,
      );
    });
  });
});
