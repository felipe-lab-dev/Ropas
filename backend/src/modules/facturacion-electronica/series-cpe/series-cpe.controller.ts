/**
 * SerieCpeController — CRUD de series de comprobantes para configuración.
 *
 * DELETE no existe (regla fiscal: una serie que emitió queda "burned" en SUNAT).
 * PUT (editar) solo procede si la serie no tiene comprobantes emitidos.
 *
 * Nota: vive bajo el prefijo global 'api/v1' del AppModule.
 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SerieCpeService } from './series-cpe.service';
import { CrearSerieCpeDto } from './dto/crear-serie-cpe.dto';
import { EditarSerieCpeDto } from './dto/editar-serie-cpe.dto';
import { AuthGuard, RequierePermiso } from '../../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../../saas/catalogo-modulos';
import { Tenant } from '../../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../../core/tenancy/tenant-context';

@Controller('series-cpe')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.FACTURACION_ELECTRONICA)
export class SerieCpeController {
  constructor(private readonly serieCpeService: SerieCpeService) {}

  /**
   * GET /api/v1/series-cpe?sucursalId=<uuid>
   * Lista todas las series del tenant, opcionalmente filtradas por sucursal.
   */
  @Get()
  @RequierePermiso('configuracion:ver')
  async listar(
    @Tenant() ctx: TenantContext,
    @Query('sucursalId') sucursalId?: string,
  ) {
    return { datos: await this.serieCpeService.listar(ctx, sucursalId) };
  }

  /**
   * POST /api/v1/series-cpe
   * Crea una nueva serie. Valida unicidad, formato y coherencia letra↔tipo.
   */
  @Post()
  @RequierePermiso('configuracion:editar')
  async crear(
    @Tenant() ctx: TenantContext,
    @Body() dto: CrearSerieCpeDto,
  ) {
    return { datos: await this.serieCpeService.crear(ctx, dto) };
  }

  /**
   * PUT /api/v1/series-cpe/:id
   * Edita una serie existente. Solo procede si la serie no tiene comprobantes
   * emitidos. Los campos omitidos mantienen su valor.
   */
  @Put(':id')
  @RequierePermiso('configuracion:editar')
  async editar(
    @Tenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarSerieCpeDto,
  ) {
    return { datos: await this.serieCpeService.editar(ctx, id, dto) };
  }
}
