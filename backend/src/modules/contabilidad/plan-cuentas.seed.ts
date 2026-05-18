/**
 * Plan Contable General Empresarial (PCGE) — núcleo para una tienda de ropa.
 * No es el catálogo completo: solo las cuentas que usamos en los asientos
 * automáticos + las hojas más comunes para asientos manuales.
 *
 * Códigos siguen el PCGE oficial peruano (SUNAT).
 */

export interface CuentaSemilla {
  codigo: string;
  nombre: string;
  nivel: number;
  padreCodigo: string | null;
  naturaleza: 'deudora' | 'acreedora';
  tipo: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto' | 'costo' | 'orden';
  aceptaMovimiento: boolean;
}

export const PLAN_CUENTAS: CuentaSemilla[] = [
  // CLASE 1 - ACTIVO DISPONIBLE Y EXIGIBLE
  { codigo: '10',     nombre: 'Efectivo y equivalentes de efectivo',  nivel: 2, padreCodigo: null,     naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: false },
  { codigo: '101',    nombre: 'Caja',                                  nivel: 3, padreCodigo: '10',     naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: false },
  { codigo: '1011',   nombre: 'Caja general',                          nivel: 4, padreCodigo: '101',    naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: true  },
  { codigo: '104',    nombre: 'Cuentas corrientes en instituciones financieras', nivel: 3, padreCodigo: '10', naturaleza: 'deudora', tipo: 'activo', aceptaMovimiento: false },
  { codigo: '1041',   nombre: 'Cuentas corrientes operativas',         nivel: 4, padreCodigo: '104',    naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: true  },
  { codigo: '107',    nombre: 'Fondos sujetos a restricción',          nivel: 3, padreCodigo: '10',     naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: true  },

  { codigo: '12',     nombre: 'Cuentas por cobrar comerciales — terceros', nivel: 2, padreCodigo: null, naturaleza: 'deudora', tipo: 'activo', aceptaMovimiento: false },
  { codigo: '121',    nombre: 'Facturas, boletas y otros comprobantes por cobrar', nivel: 3, padreCodigo: '12', naturaleza: 'deudora', tipo: 'activo', aceptaMovimiento: false },
  { codigo: '1212',   nombre: 'Emitidas en cartera',                   nivel: 4, padreCodigo: '121',    naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: true  },

  { codigo: '14',     nombre: 'Cuentas por cobrar al personal, accionistas y directores', nivel: 2, padreCodigo: null, naturaleza: 'deudora', tipo: 'activo', aceptaMovimiento: true },

  // CLASE 2 - ACTIVO REALIZABLE
  { codigo: '20',     nombre: 'Mercaderías',                           nivel: 2, padreCodigo: null,     naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: false },
  { codigo: '201',    nombre: 'Mercaderías manufacturadas',            nivel: 3, padreCodigo: '20',     naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: false },
  { codigo: '2011',   nombre: 'Mercaderías manufacturadas — costo',    nivel: 4, padreCodigo: '201',    naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: true  },

  // CLASE 3 - ACTIVO INMOVILIZADO (mínimo)
  { codigo: '33',     nombre: 'Inmuebles, maquinaria y equipo',        nivel: 2, padreCodigo: null,     naturaleza: 'deudora',   tipo: 'activo',     aceptaMovimiento: true  },

  // CLASE 4 - PASIVO
  { codigo: '40',     nombre: 'Tributos y contraprestaciones por pagar', nivel: 2, padreCodigo: null,   naturaleza: 'acreedora', tipo: 'pasivo',     aceptaMovimiento: false },
  { codigo: '401',    nombre: 'Gobierno central',                      nivel: 3, padreCodigo: '40',     naturaleza: 'acreedora', tipo: 'pasivo',     aceptaMovimiento: false },
  { codigo: '4011',   nombre: 'IGV',                                   nivel: 4, padreCodigo: '401',    naturaleza: 'acreedora', tipo: 'pasivo',     aceptaMovimiento: false },
  { codigo: '40111',  nombre: 'IGV — cuenta propia',                   nivel: 5, padreCodigo: '4011',   naturaleza: 'acreedora', tipo: 'pasivo',     aceptaMovimiento: true  },
  { codigo: '4017',   nombre: 'Impuesto a la renta',                   nivel: 4, padreCodigo: '401',    naturaleza: 'acreedora', tipo: 'pasivo',     aceptaMovimiento: true  },

  { codigo: '42',     nombre: 'Cuentas por pagar comerciales — terceros', nivel: 2, padreCodigo: null,  naturaleza: 'acreedora', tipo: 'pasivo',     aceptaMovimiento: false },
  { codigo: '421',    nombre: 'Facturas, boletas y otros comprobantes por pagar', nivel: 3, padreCodigo: '42', naturaleza: 'acreedora', tipo: 'pasivo', aceptaMovimiento: false },
  { codigo: '4212',   nombre: 'Emitidas',                              nivel: 4, padreCodigo: '421',    naturaleza: 'acreedora', tipo: 'pasivo',     aceptaMovimiento: true  },

  // CLASE 5 - PATRIMONIO
  { codigo: '50',     nombre: 'Capital',                               nivel: 2, padreCodigo: null,     naturaleza: 'acreedora', tipo: 'patrimonio', aceptaMovimiento: true  },
  { codigo: '59',     nombre: 'Resultados acumulados',                 nivel: 2, padreCodigo: null,     naturaleza: 'acreedora', tipo: 'patrimonio', aceptaMovimiento: true  },

  // CLASE 6 - GASTOS POR NATURALEZA
  { codigo: '60',     nombre: 'Compras',                               nivel: 2, padreCodigo: null,     naturaleza: 'deudora',   tipo: 'gasto',      aceptaMovimiento: false },
  { codigo: '601',    nombre: 'Mercaderías',                           nivel: 3, padreCodigo: '60',     naturaleza: 'deudora',   tipo: 'gasto',      aceptaMovimiento: false },
  { codigo: '6011',   nombre: 'Mercaderías manufacturadas',            nivel: 4, padreCodigo: '601',    naturaleza: 'deudora',   tipo: 'gasto',      aceptaMovimiento: true  },

  { codigo: '61',     nombre: 'Variación de existencias',              nivel: 2, padreCodigo: null,     naturaleza: 'acreedora', tipo: 'gasto',      aceptaMovimiento: false },
  { codigo: '611',    nombre: 'Mercaderías',                           nivel: 3, padreCodigo: '61',     naturaleza: 'acreedora', tipo: 'gasto',      aceptaMovimiento: false },
  { codigo: '6111',   nombre: 'Mercaderías manufacturadas',            nivel: 4, padreCodigo: '611',    naturaleza: 'acreedora', tipo: 'gasto',      aceptaMovimiento: true  },

  { codigo: '63',     nombre: 'Gastos de servicios prestados por terceros', nivel: 2, padreCodigo: null, naturaleza: 'deudora', tipo: 'gasto', aceptaMovimiento: true },
  { codigo: '64',     nombre: 'Gastos por tributos',                   nivel: 2, padreCodigo: null,     naturaleza: 'deudora',   tipo: 'gasto',      aceptaMovimiento: true  },
  { codigo: '65',     nombre: 'Otros gastos de gestión',               nivel: 2, padreCodigo: null,     naturaleza: 'deudora',   tipo: 'gasto',      aceptaMovimiento: true  },

  // CLASE 6 - 69 COSTO DE VENTAS
  { codigo: '69',     nombre: 'Costo de ventas',                       nivel: 2, padreCodigo: null,     naturaleza: 'deudora',   tipo: 'costo',      aceptaMovimiento: false },
  { codigo: '691',    nombre: 'Mercaderías',                           nivel: 3, padreCodigo: '69',     naturaleza: 'deudora',   tipo: 'costo',      aceptaMovimiento: false },
  { codigo: '6911',   nombre: 'Mercaderías manufacturadas',            nivel: 4, padreCodigo: '691',    naturaleza: 'deudora',   tipo: 'costo',      aceptaMovimiento: true  },

  // CLASE 7 - INGRESOS
  { codigo: '70',     nombre: 'Ventas',                                nivel: 2, padreCodigo: null,     naturaleza: 'acreedora', tipo: 'ingreso',    aceptaMovimiento: false },
  { codigo: '701',    nombre: 'Mercaderías',                           nivel: 3, padreCodigo: '70',     naturaleza: 'acreedora', tipo: 'ingreso',    aceptaMovimiento: false },
  { codigo: '7011',   nombre: 'Mercaderías manufacturadas',            nivel: 4, padreCodigo: '701',    naturaleza: 'acreedora', tipo: 'ingreso',    aceptaMovimiento: false },
  { codigo: '70111',  nombre: 'Terceros',                              nivel: 5, padreCodigo: '7011',   naturaleza: 'acreedora', tipo: 'ingreso',    aceptaMovimiento: true  },

  { codigo: '75',     nombre: 'Otros ingresos de gestión',             nivel: 2, padreCodigo: null,     naturaleza: 'acreedora', tipo: 'ingreso',    aceptaMovimiento: true  },
];

/** Cuentas hoja usadas por los generadores automáticos. */
export const CUENTAS = {
  cajaGeneral:        '1011',
  bancosOperativa:    '1041',
  cxcClientes:        '1212',
  mercaderias:        '2011',
  igvCuentaPropia:    '40111',
  cxpProveedores:     '4212',
  comprasMercaderias: '6011',
  variacionExistencias: '6111',
  costoVentas:        '6911',
  ventasMercaderias:  '70111',
} as const;

/** Medio de pago → cuenta de caja/banco que se mueve. */
export function cuentaMedioPago(medio: string): string {
  if (medio === 'efectivo') return CUENTAS.cajaGeneral;
  return CUENTAS.bancosOperativa;
}
