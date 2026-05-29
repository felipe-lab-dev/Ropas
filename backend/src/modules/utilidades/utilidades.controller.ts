import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import {
  ErrorNoEncontrado,
  ErrorServicioExterno,
  ErrorValidacion,
} from '../../core/errors/errores';
import {
  PROVEEDOR_CONSULTA_DOC,
  ProveedorConsultaDoc,
} from './consulta-doc/proveedor-consulta-doc.puerto';
import { ResultadoConsulta } from './consulta-doc/tipos';

/**
 * Endpoints transversales: consulta de DNI (RENIEC) y RUC (SUNAT).
 *
 * - Auth requerida (no público — el token del proveedor consume cuota), pero SIN
 *   permiso de módulo: el autocompletado es transversal (proveedores, clientes,
 *   ventas/POS). Atarlo a `proveedores:crear` bloquearía a un cajero creando un
 *   cliente desde el POS. Son GET read-only que no escriben en BD.
 *
 * El controller NO sabe con qué proveedor habla: inyecta el PUERTO
 * (`ProveedorConsultaDoc`) por token. Su única responsabilidad es traducir el
 * `ResultadoConsulta` a HTTP. Ver `docs/integracion-jsonpe.md`.
 */
@Controller('utilidades')
@UseGuards(AuthGuard)
export class UtilidadesController {
  constructor(
    @Inject(PROVEEDOR_CONSULTA_DOC)
    private readonly proveedor: ProveedorConsultaDoc,
  ) {}

  @Get('ruc/:ruc')
  async consultarRuc(@Param('ruc') ruc: string) {
    if (!/^\d{11}$/.test(ruc)) {
      throw new ErrorValidacion('El RUC debe tener 11 dígitos');
    }
    return this.aRespuesta(await this.proveedor.consultarRuc(ruc));
  }

  @Get('dni/:dni')
  async consultarDni(@Param('dni') dni: string) {
    if (!/^\d{8}$/.test(dni)) {
      throw new ErrorValidacion('El DNI debe tener 8 dígitos');
    }
    return this.aRespuesta(await this.proveedor.consultarDni(dni));
  }

  @Get('tipo-cambio')
  async tipoCambio(@Query('fecha') fecha?: string) {
    if (fecha !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new ErrorValidacion('La fecha debe tener formato YYYY-MM-DD');
    }
    return this.aRespuesta(await this.proveedor.consultarTipoCambio(fecha));
  }

  /**
   * Traduce los 4 casos del puerto a HTTP, preservando el contrato histórico que
   * consume el frontend: 200 `{ datos }`, 404 (no existe), 503 (técnico/sin token).
   */
  private aRespuesta<T>(resultado: ResultadoConsulta<T>): { datos: T } {
    switch (resultado.tipo) {
      case 'datos':
        return { datos: resultado.datos };
      case 'sin_datos':
        throw new ErrorNoEncontrado(resultado.mensaje);
      case 'fuera_de_servicio':
      case 'error_tecnico':
        throw new ErrorServicioExterno(resultado.mensaje);
    }
  }
}
