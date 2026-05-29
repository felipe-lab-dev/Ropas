/**
 * Contrato de datos NORMALIZADO del subsistema de consulta de documentos.
 *
 * Estos tipos son NUESTROS, no los del proveedor. El adaptador traduce los
 * nombres crudos de json.pe (`nombre_o_razon_social`, etc.) a estos campos. Si
 * mañana cambiamos de proveedor, estos tipos NO cambian.
 *
 * Ver `docs/integracion-jsonpe.md` (secciones 4 y 6).
 */

export interface DatosRuc {
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  estado: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  ubigeo: string | null;
}

export interface DatosDni {
  dni: string;
  nombres: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  nombreCompleto: string;
}

export interface DatosTipoCambio {
  venta: number; // TC venta — el usado para valorizar compras/ventas en USD
  compra: number; // TC compra
  moneda: string; // 'USD' (par USD/PEN)
  fecha: string; // fecha SUNAT efectiva del TC (YYYY-MM-DD)
}

/**
 * Resultado discriminado de cualquier consulta. Quien lo recibe DEBE chequear
 * `tipo` antes de leer `datos`. Distingue los 4 casos de la guía (sección 6):
 *  - `datos`             → todo bien, hay datos
 *  - `sin_datos`         → el documento realmente no existe (NO es un error)
 *  - `error_tecnico`     → el proveedor falló (red, rate-limit, token rechazado)
 *  - `fuera_de_servicio` → no hay token configurado (solo dev/staging)
 */
export type ResultadoConsulta<T> =
  | { tipo: 'datos'; datos: T }
  | { tipo: 'sin_datos'; mensaje: string }
  | { tipo: 'error_tecnico'; mensaje: string }
  | { tipo: 'fuera_de_servicio'; mensaje: string };
