import { ResultadoConsulta, DatosRuc, DatosDni } from './tipos';

/**
 * PUERTO (contrato). Define QUÉ se puede consultar, sin importar QUIÉN lo
 * implemente (json.pe hoy; factiliza/decolecta mañana). No conoce URLs ni tokens.
 *
 * Alcance actual: DNI (RENIEC) y RUC (SUNAT). Placa NO aplica (ERP de ropa) y el
 * tipo de cambio queda para cuando se facture en USD — agregar uno es sumar un
 * método acá y en cada adaptador.
 */
export interface ProveedorConsultaDoc {
  /** Nombre del proveedor activo (solo para logs/debug). */
  readonly nombre: string;
  /** true si está configurado (token presente). */
  readonly disponible: boolean;
  consultarRuc(ruc: string): Promise<ResultadoConsulta<DatosRuc>>;
  consultarDni(dni: string): Promise<ResultadoConsulta<DatosDni>>;
}

/**
 * Token de inyección NestJS. Como las interfaces de TS no existen en runtime,
 * los consumidores inyectan por este token: `@Inject(PROVEEDOR_CONSULTA_DOC)`.
 */
export const PROVEEDOR_CONSULTA_DOC = 'PROVEEDOR_CONSULTA_DOC';
