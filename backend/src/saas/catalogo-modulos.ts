/**
 * Catálogo único de módulos del producto Ropas.
 *
 * FUENTE DE VERDAD. Cualquier string `kebab-case` que aparezca en
 * `public.tenants.modulos_habilitados`, en `@ModuloHabilitado(...)` o
 * en un plan DEBE estar acá.
 *
 * Para sumar un módulo nuevo:
 *   1. Agregar la constante acá.
 *   2. Sumarlo a los planes que correspondan en `catalogo-planes.ts`.
 *   3. Decorar el(los) controller(s) con `@ModuloHabilitado(CATALOGO_MODULOS.MI_MODULO)`.
 *   4. (Producción) Actualizar los tenants existentes con `pnpm tenant:modulo`
 *      o reasignar plan con `pnpm tenant:plan`.
 */

export const CATALOGO_MODULOS = {
  PRODUCTOS:               'productos',
  INVENTARIO:              'inventario',
  VENTAS:                  'ventas',
  CAJA:                    'caja',
  CLIENTES:                'clientes',
  PROVEEDORES:             'proveedores',
  COMPRAS:                 'compras',
  CONTABILIDAD:            'contabilidad',
  REPORTES:                'reportes',
  USUARIOS:                'usuarios',
  CONFIGURACION:           'configuracion',
  CUPONES:                 'cupones',
  NOTAS_CREDITO:           'notas-credito',
  FACTURACION_ELECTRONICA: 'facturacion-electronica',
} as const;

export type ModuloId = typeof CATALOGO_MODULOS[keyof typeof CATALOGO_MODULOS];

export const TODOS_LOS_MODULOS: readonly ModuloId[] = Object.values(CATALOGO_MODULOS);

export function esModuloValido(s: unknown): s is ModuloId {
  return typeof s === 'string' && (TODOS_LOS_MODULOS as readonly string[]).includes(s);
}
