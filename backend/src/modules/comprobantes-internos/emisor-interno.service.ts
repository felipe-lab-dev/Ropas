import { Injectable } from '@nestjs/common';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { DatosEmisor } from './comprobante-interno-pdf.service';

/**
 * Resuelve los datos del emisor (RUC, razón social, dirección fiscal) desde
 * `ConfiguracionFacturacion` para encabezar los comprobantes internos. Si el
 * tenant no tiene facturación configurada, devuelve null y el PDF cae al nombre
 * legible de la tienda.
 */
@Injectable()
export class EmisorInternoService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async obtener(ctx: TenantContext): Promise<DatosEmisor | null> {
    const cfg = await this.prisma.forTenant(ctx).configuracionFacturacion.findFirst({
      select: {
        ruc: true,
        razonSocial: true,
        nombreComercial: true,
        direccionFiscal: true,
      },
    });
    return cfg ?? null;
  }
}
