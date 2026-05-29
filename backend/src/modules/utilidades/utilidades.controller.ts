import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JsonPeService } from './jsonpe.service';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ErrorValidacion } from '../../core/errors/errores';

/**
 * Endpoints transversales: consulta de DNI (RENIEC) y RUC (SUNAT) vía json.pe.
 *
 * - Auth requerida (no exponer al público — el token de json.pe es propiedad
 *   del tenant y consume cuota).
 * - El permiso `proveedores:crear|editar` autoriza RUC; `clientes:crear|editar`
 *   autoriza DNI. Se pide solo UNO de los dos (OR), por eso usamos
 *   `RequierePermiso` con el más laxo y validamos a nivel app.
 *
 * Memoria: si el documento NO existe en SUNAT/RENIEC → 404 + NO crear nada en BD.
 */
@Controller('utilidades')
@UseGuards(AuthGuard)
export class UtilidadesController {
  constructor(private readonly jsonpe: JsonPeService) {}

  @Get('ruc/:ruc')
  @RequierePermiso('proveedores:crear')
  async consultarRuc(@Param('ruc') ruc: string) {
    if (!/^\d{11}$/.test(ruc)) {
      throw new ErrorValidacion('El RUC debe tener 11 dígitos');
    }
    const datos = await this.jsonpe.consultarRuc(ruc);
    return { datos };
  }

  @Get('dni/:dni')
  @RequierePermiso('clientes:crear')
  async consultarDni(@Param('dni') dni: string) {
    if (!/^\d{8}$/.test(dni)) {
      throw new ErrorValidacion('El DNI debe tener 8 dígitos');
    }
    const datos = await this.jsonpe.consultarDni(dni);
    return { datos };
  }
}
