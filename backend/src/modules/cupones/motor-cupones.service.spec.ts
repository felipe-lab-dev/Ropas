import { MotorCuponesService, CuponEvaluable, ItemCarrito } from './motor-cupones.service';

const NOW = new Date('2026-05-24T12:00:00Z');

function cuponBase(overrides: Partial<CuponEvaluable> = {}): CuponEvaluable {
  return {
    estado: 'activo',
    eliminadoEn: null,
    fechaInicio: new Date('2026-05-01T00:00:00Z'),
    fechaFin: new Date('2026-06-30T23:59:59Z'),
    tipoDescuento: 'porcentaje',
    valorDescuento: 20,
    montoMinimoCompra: null,
    descuentoMaximo: null,
    usosMaximosTotal: null,
    usosMaximosPorCliente: 1,
    segmento: 'todos',
    clientesElegiblesIds: [],
    aplicableA: 'toda_compra',
    categoriasAplicablesIds: [],
    productosAplicablesIds: [],
    ...overrides,
  };
}

function item(overrides: Partial<ItemCarrito> = {}): ItemCarrito {
  return {
    varianteId: 'v1',
    productoId: 'p1',
    categoriaId: 'cat-default',
    cantidad: 1,
    precioUnitario: 100,
    ...overrides,
  };
}

describe('MotorCuponesService', () => {
  const motor = new MotorCuponesService();

  // ─── ESTADO ────────────────────────────────────────────────────────

  describe('estado del cupón', () => {
    it('rechaza si el cupón fue eliminado', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ eliminadoEn: new Date() }),
        carrito: [item()],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/eliminado/i);
    });

    it('rechaza si está pausado', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ estado: 'pausado' }),
        carrito: [item()],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/pausado/i);
    });
  });

  // ─── VIGENCIA ──────────────────────────────────────────────────────

  describe('vigencia', () => {
    it('rechaza si todavía no inició', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ fechaInicio: new Date('2026-06-01T00:00:00Z') }),
        carrito: [item()],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/empieza/i);
    });

    it('rechaza si está vencido', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ fechaFin: new Date('2026-05-01T00:00:00Z') }),
        carrito: [item()],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/vencido/i);
    });

    it('acepta en el borde justo del inicio', () => {
      const inicio = new Date('2026-05-24T12:00:00Z');
      const res = motor.evaluar({
        cupon: cuponBase({ fechaInicio: inicio }),
        carrito: [item()],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: inicio,
      });
      expect(res.valido).toBe(true);
    });
  });

  // ─── LÍMITES DE USO ────────────────────────────────────────────────

  describe('límites de uso', () => {
    it('rechaza cuando se alcanzó el límite total', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ usosMaximosTotal: 50 }),
        carrito: [item()],
        usosTotalesActuales: 50,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/agot/i);
    });

    it('acepta justo en el borde del límite total (51º uso bloquea, 50º permitido)', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ usosMaximosTotal: 50 }),
        carrito: [item()],
        usosTotalesActuales: 49,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(true);
    });

    it('rechaza cuando el cliente alcanzó su límite individual', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ usosMaximosPorCliente: 2 }),
        carrito: [item()],
        clienteIdSolicitante: 'cliente-1',
        usosTotalesActuales: 0,
        usosDelClienteActuales: 2,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/m[aá]ximo|2 usos/i);
    });

    it('para 1 uso por cliente, mensaje específico "ya usó"', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ usosMaximosPorCliente: 1 }),
        carrito: [item()],
        clienteIdSolicitante: 'cliente-1',
        usosTotalesActuales: 0,
        usosDelClienteActuales: 1,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/ya us[oó]/i);
    });
  });

  // ─── SEGMENTOS ─────────────────────────────────────────────────────

  describe('segmentos', () => {
    it('VIP AA rechaza si la clasificación no es AA', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ segmento: 'vip_aa' }),
        carrito: [item()],
        clienteIdSolicitante: 'c1',
        clienteClasificacion: 'A',
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/AA/);
    });

    it('VIP A acepta tanto AA como A', () => {
      for (const cls of ['AA', 'A'] as const) {
        const res = motor.evaluar({
          cupon: cuponBase({ segmento: 'vip_a' }),
          carrito: [item()],
          clienteClasificacion: cls,
          usosTotalesActuales: 0,
          usosDelClienteActuales: 0,
          ahora: NOW,
        });
        expect(res.valido).toBe(true);
      }
    });

    it('VIP A rechaza B/C/D', () => {
      for (const cls of ['B', 'C', 'D'] as const) {
        const res = motor.evaluar({
          cupon: cuponBase({ segmento: 'vip_a' }),
          carrito: [item()],
          clienteClasificacion: cls,
          usosTotalesActuales: 0,
          usosDelClienteActuales: 0,
          ahora: NOW,
        });
        expect(res.valido).toBe(false);
      }
    });

    it('VIP B incluye A y AA', () => {
      for (const cls of ['AA', 'A', 'B'] as const) {
        const res = motor.evaluar({
          cupon: cuponBase({ segmento: 'vip_b' }),
          carrito: [item()],
          clienteClasificacion: cls,
          usosTotalesActuales: 0,
          usosDelClienteActuales: 0,
          ahora: NOW,
        });
        expect(res.valido).toBe(true);
      }
    });

    it('lista_clientes rechaza si no se identifica al cliente', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ segmento: 'lista_clientes', clientesElegiblesIds: ['c1'] }),
        carrito: [item()],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/identificar/i);
    });

    it('lista_clientes rechaza si el cliente no está en la lista', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ segmento: 'lista_clientes', clientesElegiblesIds: ['cA', 'cB'] }),
        carrito: [item()],
        clienteIdSolicitante: 'cX',
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
    });

    it('lista_clientes acepta si está en la lista', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ segmento: 'lista_clientes', clientesElegiblesIds: ['cA', 'cB'] }),
        carrito: [item()],
        clienteIdSolicitante: 'cA',
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(true);
    });
  });

  // ─── APLICABILIDAD ─────────────────────────────────────────────────

  describe('aplicabilidad', () => {
    it('toda_compra usa todos los items', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ aplicableA: 'toda_compra' }),
        carrito: [item({ precioUnitario: 50 }), item({ varianteId: 'v2', precioUnitario: 80 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(true);
      // 20% de (50 + 80) = 26
      expect(res.descuento).toBe(26);
    });

    it('categorias filtra por categoriaId', () => {
      const res = motor.evaluar({
        cupon: cuponBase({
          aplicableA: 'categorias',
          categoriasAplicablesIds: ['cat-A'],
        }),
        carrito: [
          item({ categoriaId: 'cat-A', precioUnitario: 100 }),
          item({ varianteId: 'v2', categoriaId: 'cat-B', precioUnitario: 50 }),
        ],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(true);
      // Solo aplica al de cat-A (100 * 20% = 20)
      expect(res.descuento).toBe(20);
      expect(res.baseAplicable).toBe(100);
    });

    it('productos filtra por productoId', () => {
      const res = motor.evaluar({
        cupon: cuponBase({
          aplicableA: 'productos',
          productosAplicablesIds: ['p1'],
        }),
        carrito: [
          item({ productoId: 'p1', precioUnitario: 100 }),
          item({ varianteId: 'v2', productoId: 'p2', precioUnitario: 50 }),
        ],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(true);
      expect(res.descuento).toBe(20);
    });

    it('rechaza si ningún item aplica', () => {
      const res = motor.evaluar({
        cupon: cuponBase({
          aplicableA: 'categorias',
          categoriasAplicablesIds: ['cat-A'],
        }),
        carrito: [item({ categoriaId: 'cat-B' })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/categor/i);
    });
  });

  // ─── MÍNIMO DE COMPRA ──────────────────────────────────────────────

  describe('monto mínimo', () => {
    it('rechaza si el total del carrito no llega al mínimo', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ montoMinimoCompra: 200 }),
        carrito: [item({ precioUnitario: 50, cantidad: 2 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(false);
      expect(res.mensaje).toMatch(/falta/i);
    });

    it('acepta justo en el mínimo', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ montoMinimoCompra: 200 }),
        carrito: [item({ precioUnitario: 100, cantidad: 2 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(true);
    });

    it('el mínimo se evalúa sobre el TOTAL del carrito, no sobre la base aplicable (categorías)', () => {
      // El carrito total es 200, mínimo 200, pero solo cat-A aplica.
      // El mínimo se cumple aunque el descuento se calcule sobre menos.
      const res = motor.evaluar({
        cupon: cuponBase({
          montoMinimoCompra: 200,
          aplicableA: 'categorias',
          categoriasAplicablesIds: ['cat-A'],
        }),
        carrito: [
          item({ categoriaId: 'cat-A', precioUnitario: 100 }),
          item({ varianteId: 'v2', categoriaId: 'cat-B', precioUnitario: 100 }),
        ],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(true);
      // 20% de 100 (solo el de cat-A)
      expect(res.descuento).toBe(20);
    });
  });

  // ─── CÁLCULO DE DESCUENTO ──────────────────────────────────────────

  describe('cálculo de descuento', () => {
    it('porcentaje calcula sobre base aplicable', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ tipoDescuento: 'porcentaje', valorDescuento: 25 }),
        carrito: [item({ precioUnitario: 100, cantidad: 3 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.descuento).toBe(75);
    });

    it('monto fijo aplica el monto literal', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ tipoDescuento: 'monto_fijo', valorDescuento: 50 }),
        carrito: [item({ precioUnitario: 200 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.descuento).toBe(50);
    });

    it('monto fijo no descuenta más que la base aplicable', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ tipoDescuento: 'monto_fijo', valorDescuento: 500 }),
        carrito: [item({ precioUnitario: 100 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.descuento).toBe(100);
    });

    it('porcentaje respeta el descuentoMaximo', () => {
      const res = motor.evaluar({
        cupon: cuponBase({
          tipoDescuento: 'porcentaje',
          valorDescuento: 50,
          descuentoMaximo: 100,
        }),
        carrito: [item({ precioUnitario: 1000 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      // 50% de 1000 = 500, pero tope 100
      expect(res.descuento).toBe(100);
    });

    it('redondea a 2 decimales', () => {
      const res = motor.evaluar({
        cupon: cuponBase({ tipoDescuento: 'porcentaje', valorDescuento: 33 }),
        carrito: [item({ precioUnitario: 99.95 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      // 33% de 99.95 = 32.9835 → 32.98
      expect(res.descuento).toBe(32.98);
    });

    it('acepta Decimal de prisma (string-like) como input', () => {
      const res = motor.evaluar({
        cupon: cuponBase({
          tipoDescuento: 'porcentaje',
          valorDescuento: { toString: () => '20' } as never,
        }),
        carrito: [item({ precioUnitario: 100 })],
        usosTotalesActuales: 0,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.descuento).toBe(20);
    });
  });

  // ─── COMBOS INTERACTIVOS ───────────────────────────────────────────

  describe('combinaciones', () => {
    it('cupón perfectamente válido: VIP A, vigente, sin tope, monto mínimo cumplido', () => {
      const res = motor.evaluar({
        cupon: cuponBase({
          segmento: 'vip_a',
          montoMinimoCompra: 100,
          valorDescuento: 30,
          descuentoMaximo: 200,
        }),
        carrito: [item({ precioUnitario: 250 })],
        clienteIdSolicitante: 'c1',
        clienteClasificacion: 'A',
        usosTotalesActuales: 5,
        usosDelClienteActuales: 0,
        ahora: NOW,
      });
      expect(res.valido).toBe(true);
      // 30% de 250 = 75
      expect(res.descuento).toBe(75);
      expect(res.baseAplicable).toBe(250);
    });
  });
});
