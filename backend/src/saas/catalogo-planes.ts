/**
 * Catálogo de planes — qué módulos vienen incluidos en cada plan.
 *
 * Esta capa vive en el backend de Ropas hasta que ENKI real sea la fuente
 * de verdad de planes. Cuando ENKI exista, este archivo desaparece y los
 * planes vienen del portal SaaS.
 *
 * Convención: los planes son acumulativos. `comercial ⊇ basico`, `fiscal ⊇ comercial`,
 * `full = todos`. Si necesitás un plan no acumulativo, agregalo aparte.
 */
import { CATALOGO_MODULOS as M, ModuloId, TODOS_LOS_MODULOS } from './catalogo-modulos';

export type PlanId = 'basico' | 'comercial' | 'fiscal' | 'full';

const BASICO: ModuloId[] = [
  M.PRODUCTOS,
  M.VENTAS,
  M.CAJA,
  M.CLIENTES,
  M.REPORTES,
  M.USUARIOS,
  M.CONFIGURACION,
];

const COMERCIAL: ModuloId[] = [
  ...BASICO,
  M.INVENTARIO,
  M.PROVEEDORES,
  M.COMPRAS,
  M.NOTAS_CREDITO,
  M.CUPONES,
];

const FISCAL: ModuloId[] = [
  ...COMERCIAL,
  M.CONTABILIDAD,
  M.FACTURACION_ELECTRONICA,
];

const FULL: ModuloId[] = [...TODOS_LOS_MODULOS];

export const PLANES: Record<PlanId, readonly ModuloId[]> = {
  basico: BASICO,
  comercial: COMERCIAL,
  fiscal: FISCAL,
  full: FULL,
};

export function modulosDePlan(plan: string): readonly ModuloId[] {
  if (plan in PLANES) return PLANES[plan as PlanId];
  // Plan desconocido → no se asumen permisos. El llamador decide qué hacer
  // (por defecto: full para dev, vacío para prod estricto).
  return PLANES.full;
}

export function esPlanValido(s: unknown): s is PlanId {
  return typeof s === 'string' && s in PLANES;
}
