import {
  calcularRentabilidadVenta,
  calcularRentabilidadItem,
} from './rentabilidad';

describe('rentabilidad', () => {
  describe('calcularRentabilidadVenta', () => {
    it('margen saludable (≥30%)', () => {
      const r = calcularRentabilidadVenta({
        items: [{ cantidad: 1, subtotal: '100', costoUnitario: '60' }],
      });
      expect(r.ingresoNeto).toBe(100);
      expect(r.costoTotal).toBe(60);
      expect(r.ganancia).toBe(40);
      expect(r.margenPct).toBe(40);
      expect(r.markupPct).toBeCloseTo(66.67, 2);
      expect(r.nivel).toBe('saludable');
      expect(r.confiable).toBe(true);
    });

    it('margen aceptable (15–29%)', () => {
      const r = calcularRentabilidadVenta({
        items: [{ cantidad: 1, subtotal: '100', costoUnitario: '80' }],
      });
      expect(r.margenPct).toBe(20);
      expect(r.nivel).toBe('aceptable');
    });

    it('margen bajo (5–14%)', () => {
      const r = calcularRentabilidadVenta({
        items: [{ cantidad: 1, subtotal: '100', costoUnitario: '90' }],
      });
      expect(r.margenPct).toBe(10);
      expect(r.nivel).toBe('bajo');
    });

    it('pérdida (<5%, incluye negativo)', () => {
      const r = calcularRentabilidadVenta({
        items: [{ cantidad: 1, subtotal: '100', costoUnitario: '120' }],
      });
      expect(r.ganancia).toBe(-20);
      expect(r.margenPct).toBe(-20);
      expect(r.nivel).toBe('perdida');
    });

    it('sin_datos cuando ningún ítem tiene costo', () => {
      const r = calcularRentabilidadVenta({
        items: [{ cantidad: 1, subtotal: '100', costoUnitario: null }],
      });
      expect(r.nivel).toBe('sin_datos');
      expect(r.costoTotal).toBe(0);
      expect(r.margenPct).toBeNull();
      expect(r.itemsConCosto).toBe(0);
    });

    it('parcial cuando algunos ítems no tienen costo', () => {
      const r = calcularRentabilidadVenta({
        items: [
          { cantidad: 1, subtotal: '100', costoUnitario: '60' },
          { cantidad: 1, subtotal: '50', costoUnitario: null },
        ],
      });
      expect(r.itemsTotal).toBe(2);
      expect(r.itemsConCosto).toBe(1);
      expect(r.confiable).toBe(false);
      expect(r.nivel).toBe('parcial');
    });

    it('descuento global y de cupón reducen el ingreso neto', () => {
      const r = calcularRentabilidadVenta({
        items: [{ cantidad: 2, subtotal: '200', costoUnitario: '60' }],
        descuento: '20',
        descuentoCupon: '30',
      });
      // ingresoNeto = 200 − 20 − 30 = 150; costo = 2×60 = 120; ganancia = 30
      expect(r.ingresoNeto).toBe(150);
      expect(r.costoTotal).toBe(120);
      expect(r.ganancia).toBe(30);
      expect(r.margenPct).toBe(20);
      expect(r.nivel).toBe('aceptable');
    });

    it('venta vacía → sin_datos', () => {
      const r = calcularRentabilidadVenta({ items: [] });
      expect(r.nivel).toBe('sin_datos');
      expect(r.itemsTotal).toBe(0);
    });

    it('suma costo por cantidad correctamente', () => {
      const r = calcularRentabilidadVenta({
        items: [
          { cantidad: 3, subtotal: '300', costoUnitario: '50' },
          { cantidad: 2, subtotal: '200', costoUnitario: '40' },
        ],
      });
      // costo = 3×50 + 2×40 = 230; ingreso = 500; ganancia = 270; margen = 54
      expect(r.costoTotal).toBe(230);
      expect(r.margenPct).toBe(54);
      expect(r.nivel).toBe('saludable');
    });
  });

  describe('calcularRentabilidadItem', () => {
    it('calcula margen por línea', () => {
      const r = calcularRentabilidadItem({ cantidad: 2, subtotal: '100', costoUnitario: '30' });
      // costo = 2×30 = 60; ganancia = 40; margen = 40
      expect(r.costoTotal).toBe(60);
      expect(r.ganancia).toBe(40);
      expect(r.margenPct).toBe(40);
      expect(r.nivel).toBe('saludable');
    });

    it('línea sin costo → sin_datos', () => {
      const r = calcularRentabilidadItem({ cantidad: 1, subtotal: '100', costoUnitario: null });
      expect(r.costoUnitario).toBeNull();
      expect(r.margenPct).toBeNull();
      expect(r.nivel).toBe('sin_datos');
    });
  });
});
