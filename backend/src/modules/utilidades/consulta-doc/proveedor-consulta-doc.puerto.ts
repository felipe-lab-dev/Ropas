import { ResultadoConsulta, DatosRuc, DatosDni, DatosTipoCambio } from './tipos';

/**
 * PUERTO (contrato). Define QUÉ se puede consultar, sin importar QUIÉN lo
 * implemente (json.pe hoy; factiliza/decolecta mañana). No conoce URLs ni tokens.
 *
 * Alcance actual: DNI (RENIEC), RUC (SUNAT) y tipo de cambio USD/PEN (SUNAT).
 * Placa NO aplica (ERP de ropa) — agregar otra fuente es sumar un método acá y
 * en cada adaptador.
 */
export interface ProveedorConsultaDoc {
  /** Nombre del proveedor activo (solo para logs/debug). */
  readonly nombre: string;
  /** true si está configurado (token presente). */
  readonly disponible: boolean;
  consultarRuc(ruc: string): Promise<ResultadoConsulta<DatosRuc>>;
  consultarDni(dni: string): Promise<ResultadoConsulta<DatosDni>>;
  /** TC oficial SUNAT de una fecha (YYYY-MM-DD). Sin fecha → hoy (zona Lima). */
  consultarTipoCambio(
    fecha?: string,
  ): Promise<ResultadoConsulta<DatosTipoCambio>>;
}

/**
 * Token de inyección NestJS. Como las interfaces de TS no existen en runtime,
 * los consumidores inyectan por este token: `@Inject(PROVEEDOR_CONSULTA_DOC)`.
 */
export const PROVEEDOR_CONSULTA_DOC = 'PROVEEDOR_CONSULTA_DOC';
