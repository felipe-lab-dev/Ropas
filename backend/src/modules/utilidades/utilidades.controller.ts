import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JsonPeService } from './jsonpe.service';
import { AuthGuard } from '../auth/auth.guard';
import { ErrorValidacion } from '../../core/errors/errores';

/**
 * Endpoints transversales: consulta de DNI (RENIEC) y RUC (SUNAT) vía json.pe.
 *
 * - Auth requerida (no público — el token de json.pe es propiedad del tenant y
 *   consume cuota), pero SIN permiso de módulo: el autocompletado es transversal
 *   (proveedores, clientes, ventas/POS, etc.). Atarlo a `proveedores:crear`
 *   bloqueaba a un cajero creando un cliente desde el POS. Son endpoints GET
 *   read-only que no escriben en BD, así que basta con estar autenticado.
 *
 * Memoria: si el documento NO existe en SUNAT/RENIEC → 404 + NO crear nada en BD.
 */
@Controller('utilidades')
@UseGuards(AuthGuard)
export class UtilidadesController {
  constructor(private readonly jsonpe: JsonPeService) {}

  @Get('ruc/:ruc')
  async consultarRuc(@Param('ruc') ruc: string) {
    if (!/^\d{11}$/.test(ruc)) {
      throw new ErrorValidacion('El RUC debe tener 11 dígitos');
    }
    const datos = await this.jsonpe.consultarRuc(ruc);
    return { datos };
  }

  @Get('dni/:dni')
  async consultarDni(@Param('dni') dni: string) {
    if (!/^\d{8}$/.test(dni)) {
      throw new ErrorValidacion('El DNI debe tener 8 dígitos');
    }
    const datos = await this.jsonpe.consultarDni(dni);
    return { datos };
  }
}
