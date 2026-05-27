/**
 * SerieCpeController — CRUD de series CPE para configuración.
 *
 * DELETE no existe: las series nunca se eliminan físicamente (regla fiscal).
 * Una serie "en desuso" se desactiva (activa=false) pero permanece en DB.
 * Solo se permite toggle de `activa` vía PATCH.
 *
 * Nota: vive bajo el prefijo global 'api/v1' del AppModule.
 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SerieCpeService } from './series-cpe.service';
import { CrearSerieCpeDto } from './dto/crear-serie-cpe.dto';
import { ActualizarSerieCpeDto } from './dto/actualizar-serie-cpe.dto';
import { AuthGuard, RequierePermiso } from '../../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../../saas/modulo-habilitado.guard';
import { Tenant } from '../../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../../core/tenancy/tenant-context';

@Controller('series-cpe')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado('facturacion-electronica')
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
   * Crea una nueva serie CPE. Valida unicidad, formato y coherencia letra↔tipo.
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
   * PATCH /api/v1/series-cpe/:id
   * Permite SOLO toggle de `activa`. Campos inmutables (serie, tipoCpe,
   * correlativoActual, sucursalId) se ignoran si vienen en el body.
   */
  @Patch(':id')
  @RequierePermiso('configuracion:editar')
  async actualizar(
    @Tenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarSerieCpeDto,
  ) {
    return { datos: await this.serieCpeService.actualizar(ctx, id, dto) };
  }
}
