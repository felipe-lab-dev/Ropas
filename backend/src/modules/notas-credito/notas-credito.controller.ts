import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { NotasCreditoService } from './notas-credito.service';
import { CrearNotaCreditoDto } from './dto/crear-nota-credito.dto';
import { ComprobanteInternoPdfService } from '../comprobantes-internos/comprobante-interno-pdf.service';
import { EmisorInternoService } from '../comprobantes-internos/emisor-interno.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('notas-credito')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.NOTAS_CREDITO)
export class NotasCreditoController {
  constructor(
    private readonly service: NotasCreditoService,
    private readonly pdf: ComprobanteInternoPdfService,
    private readonly emisor: EmisorInternoService,
  ) {}

  @Get() @RequierePermiso('notas-credito:leer')
  async listar(@Query() q: any, @Tenant() ctx: TenantContext) {
    return this.service.listar(q, ctx);
  }

  @Get(':id') @RequierePermiso('notas-credito:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  /**
   * PDF de control interno de la NC. Para devoluciones internas (sin CPE) es el
   * único documento imprimible; las NC con comprobante electrónico ya tienen su
   * PDF de MiFact. El sello deja claro que NO tiene validez tributaria.
   */
  @Get(':id/pdf-interno') @RequierePermiso('notas-credito:leer')
  async pdfInterno(
    @Param('id') id: string,
    @Tenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const [nc, emisor] = await Promise.all([
      this.service.obtener(id, ctx),
      this.emisor.obtener(ctx),
    ]);
    const buffer = await this.pdf.generarPdfNotaCredito({
      emisor,
      tienda: ctx.nombre,
      sucursalNombre: nc.sucursal?.nombre,
      sucursalDireccion: nc.sucursal?.direccion,
      numero: nc.numero,
      fecha: nc.creadoEn,
      moneda: 'PEN',
      clienteNombre: nc.cliente?.nombre ?? null,
      clienteDocumento: formatearDocumento(nc.cliente),
      motivo: nc.motivo,
      ventaOriginalNumero: nc.venta?.numero ?? null,
      emitidaPorNombre: nc.emitidaPor?.nombre ?? null,
      items: nc.items.map(it => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnitario: Number(it.precioUnitario),
        subtotal: Number(it.subtotal),
      })),
      subtotal: Number(nc.subtotal),
      total: Number(nc.total),
    });
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `inline; filename="${nc.numero}.pdf"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }

  @Post() @RequierePermiso('notas-credito:crear')
  async crear(
    @Body() dto: CrearNotaCreditoDto,
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const nota = await this.service.crear(dto, ctx, req.usuario!.sub);
    return { datos: nota, mensaje: `Nota de crédito ${nota.numero} emitida` };
  }

  @Post(':id/anular') @RequierePermiso('notas-credito:anular')
  async anular(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const nota = await this.service.anular(id, body.motivo, ctx, req.usuario!.sub);
    return { datos: nota, mensaje: 'Nota de crédito anulada' };
  }
}

/** Documento del cliente ya formateado (ej. "DNI 70498300"), o null si no tiene. */
function formatearDocumento(
  cliente: { tipoDocumento?: string | null; documento?: string | null } | null | undefined,
): string | null {
  if (!cliente?.documento) return null;
  const tipo = cliente.tipoDocumento ? `${cliente.tipoDocumento.toUpperCase()} ` : '';
  return `${tipo}${cliente.documento}`;
}
