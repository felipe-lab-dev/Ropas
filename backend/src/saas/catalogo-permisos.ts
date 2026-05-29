/**
 * Catálogo único de permisos del producto Ropas — FUENTE DE VERDAD.
 *
 * Cada permiso tiene formato `modulo:accion`. Este catálogo es lo que consume el
 * módulo de Accesos (matriz módulo × acción) y lo que valida que un rol no reciba
 * permisos inexistentes. El rol Administrador usa el wildcard `*` (no listado acá).
 *
 * Para sumar un permiso nuevo:
 *   1. Agregar la acción al módulo correspondiente acá.
 *   2. Usarlo en `@RequierePermiso('modulo:accion')` en el controller.
 */

export interface AccionPermiso {
  /** Código `modulo:accion` usado en `@RequierePermiso`. */
  codigo: string;
  /** Etiqueta legible para la matriz de Accesos. */
  label: string;
}

export interface ModuloPermiso {
  /** Identificador del módulo (kebab-case). */
  modulo: string;
  /** Etiqueta legible del módulo. */
  label: string;
  acciones: AccionPermiso[];
}

export const CATALOGO_PERMISOS: ModuloPermiso[] = [
  {
    modulo: 'ventas',
    label: 'Ventas',
    acciones: [
      { codigo: 'ventas:leer', label: 'Ver listado' },
      { codigo: 'ventas:ver', label: 'Ver detalle' },
      { codigo: 'ventas:crear', label: 'Registrar venta' },
      { codigo: 'ventas:anular', label: 'Anular venta' },
      { codigo: 'ventas:emitir-cpe', label: 'Emitir comprobante SUNAT' },
    ],
  },
  {
    modulo: 'caja',
    label: 'Caja',
    acciones: [
      { codigo: 'caja:leer', label: 'Ver caja e historial' },
      { codigo: 'caja:operar', label: 'Abrir, cerrar y registrar movimientos' },
    ],
  },
  {
    modulo: 'notas-credito',
    label: 'Notas de crédito',
    acciones: [
      { codigo: 'notas-credito:leer', label: 'Ver notas de crédito' },
      { codigo: 'notas-credito:crear', label: 'Crear nota de crédito' },
      { codigo: 'notas-credito:anular', label: 'Anular nota de crédito' },
      { codigo: 'notas-credito:emitir-cpe', label: 'Emitir a SUNAT' },
    ],
  },
  {
    modulo: 'productos',
    label: 'Productos',
    acciones: [
      { codigo: 'productos:leer', label: 'Ver productos' },
      { codigo: 'productos:crear', label: 'Crear producto' },
      { codigo: 'productos:editar', label: 'Editar producto' },
      { codigo: 'productos:eliminar', label: 'Eliminar producto' },
    ],
  },
  {
    modulo: 'inventario',
    label: 'Inventario',
    acciones: [
      { codigo: 'inventario:leer', label: 'Ver stock' },
      { codigo: 'inventario:ajustar', label: 'Ajustar stock y movimientos' },
    ],
  },
  {
    modulo: 'proveedores',
    label: 'Proveedores',
    acciones: [
      { codigo: 'proveedores:leer', label: 'Ver proveedores' },
      { codigo: 'proveedores:crear', label: 'Crear proveedor' },
      { codigo: 'proveedores:editar', label: 'Editar proveedor' },
      { codigo: 'proveedores:eliminar', label: 'Eliminar proveedor' },
    ],
  },
  {
    modulo: 'compras',
    label: 'Compras',
    acciones: [
      { codigo: 'compras:leer', label: 'Ver compras' },
      { codigo: 'compras:crear', label: 'Registrar compra' },
      { codigo: 'compras:pagar', label: 'Pagar compra' },
      { codigo: 'compras:anular', label: 'Anular compra' },
    ],
  },
  {
    modulo: 'clientes',
    label: 'Clientes',
    acciones: [
      { codigo: 'clientes:leer', label: 'Ver clientes' },
      { codigo: 'clientes:crear', label: 'Crear cliente' },
      { codigo: 'clientes:editar', label: 'Editar cliente' },
      { codigo: 'clientes:eliminar', label: 'Eliminar cliente' },
    ],
  },
  {
    modulo: 'cupones',
    label: 'Cupones',
    acciones: [
      { codigo: 'cupones:leer', label: 'Ver cupones' },
      { codigo: 'cupones:crear', label: 'Crear cupón' },
      { codigo: 'cupones:editar', label: 'Editar cupón' },
      { codigo: 'cupones:eliminar', label: 'Eliminar cupón' },
      { codigo: 'cupones:aplicar', label: 'Aplicar cupón en venta' },
    ],
  },
  {
    modulo: 'contabilidad',
    label: 'Contabilidad',
    acciones: [
      { codigo: 'contabilidad:leer', label: 'Ver asientos y libros' },
      { codigo: 'contabilidad:crear', label: 'Crear asiento' },
      { codigo: 'contabilidad:cerrar', label: 'Cerrar período' },
      { codigo: 'contabilidad:reversar', label: 'Reversar asiento' },
      { codigo: 'contabilidad:exportar', label: 'Exportar libros' },
    ],
  },
  {
    modulo: 'reportes',
    label: 'Reportes',
    acciones: [{ codigo: 'reportes:leer', label: 'Ver reportes' }],
  },
  {
    modulo: 'sucursales',
    label: 'Sucursales',
    acciones: [
      { codigo: 'sucursales:leer', label: 'Ver sucursales' },
      { codigo: 'sucursales:crear', label: 'Crear sucursal' },
    ],
  },
  {
    modulo: 'configuracion',
    label: 'Configuración',
    acciones: [
      { codigo: 'configuracion:ver', label: 'Ver configuración' },
      { codigo: 'configuracion:editar', label: 'Editar configuración' },
    ],
  },
  {
    modulo: 'usuarios',
    label: 'Usuarios',
    acciones: [
      { codigo: 'usuarios:leer', label: 'Ver usuarios' },
      { codigo: 'usuarios:crear', label: 'Crear usuario' },
      { codigo: 'usuarios:editar', label: 'Editar usuario y resetear contraseña' },
      { codigo: 'usuarios:eliminar', label: 'Eliminar usuario' },
    ],
  },
  {
    modulo: 'roles',
    label: 'Accesos y roles',
    acciones: [
      { codigo: 'roles:leer', label: 'Ver roles y permisos' },
      { codigo: 'roles:crear', label: 'Crear rol' },
      { codigo: 'roles:editar', label: 'Editar permisos de un rol' },
      { codigo: 'roles:eliminar', label: 'Eliminar rol' },
    ],
  },
];

/** Lista plana de todos los códigos de permiso válidos. */
export const TODOS_LOS_PERMISOS: readonly string[] = CATALOGO_PERMISOS.flatMap(m =>
  m.acciones.map(a => a.codigo),
);

const SET_PERMISOS = new Set(TODOS_LOS_PERMISOS);

/** True si el código existe en el catálogo (el wildcard `*` NO se considera asignable acá). */
export function esPermisoValido(codigo: string): boolean {
  return SET_PERMISOS.has(codigo);
}
