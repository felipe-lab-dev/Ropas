export interface TenantContext {
  /** Código corto del tenant (ej. "mi-tienda") */
  codigo: string;
  /** Schema PostgreSQL real (ej. "tenant_mi_tienda") */
  schemaName: string;
  /** Nombre legible */
  nombre: string;
  /** Plan asignado en ENKI */
  plan: string;
  /** Módulos habilitados según plan */
  modulosHabilitados: string[];
  /** Límites del plan */
  limites: Record<string, number>;
  /** ¿Cliente con acceso permitido (no suspendido, trial vigente)? */
  accesoPermitido: boolean;
}>
