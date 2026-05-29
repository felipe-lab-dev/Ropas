import { Controller, Get, Param } from '@nestjs/common';
import { BrandingService } from './branding.service';

/**
 * Endpoints PÚBLICOS de branding (sin AuthGuard, exentos del TenantMiddleware vía
 * RUTAS_SIN_TENANT). El login los consume antes de autenticar para mostrar la
 * identidad de la tienda y poblar el selector de tiendas.
 */
@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  /** Lista de tiendas para el selector del login (vacía en producción). */
  @Get('tiendas')
  async tiendas() {
    return { datos: await this.branding.listarTiendas() };
  }

  /** Branding público de una tienda por código. Definido DESPUÉS de `tiendas`. */
  @Get(':codigo')
  async porCodigo(@Param('codigo') codigo: string) {
    return { datos: await this.branding.obtenerPublico(codigo) };
  }
}
