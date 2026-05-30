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
import { VentasService } from './ventas.service';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { ComprobanteInternoPdfService } from '../comprobantes-internos/comprobante-interno-pdf.service';
import { EmisorInternoService } from '../comprobantes-internos/emisor-interno.service';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { AuthGuard, RequierePermiso } from '../auth/auth.guard';
import { ModuloHabilitado, ModuloHabilitadoGuard } from '../../saas/modulo-habilitado.guard';
import { CATALOGO_MODULOS } from '../../saas/catalogo-modulos';

@Controller('ventas')
@UseGuards(ModuloHabilitadoGuard, AuthGuard)
@ModuloHabilitado(CATALOGO_MODULOS.VENTAS)
export class VentasController {
  constructor(
    private readonly service: VentasService,
    private readonly pdf: ComprobanteInternoPdfService,
    private readonly emisor: EmisorInternoService,
  ) {}

  @Get() @RequierePermiso('ventas:leer')
  async listar(@Query() q: any, @Tenant() ctx: TenantContext, @Req() req: Request) {
    return this.service.listar(q, ctx, req.usuario!.permisos);
  }

  @Get(':id') @RequierePermiso('ventas:leer')
  async obtener(@Param('id') id: string, @Tenant() ctx: TenantContext) {
    return { datos: await this.service.obtener(id, ctx) };
  }

  /**
   * PDF de control interno de la venta. Para notas de venta internas (sin CPE)
   * es el único documento imprimible; las ventas con comprobante electrónico ya
   * tienen su PDF de MiFact. El sello deja claro que NO tiene validez tributaria.
   */
  @Get(':id/pdf-interno') @RequierePermiso('ventas:leer')
  async pdfInterno(
    @Param('id') id: string,
    @Tenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const [venta, emisor] = await Promise.all([
      this.service.obtener(id, ctx),
      this.emisor.obtener(ctx),
    ]);
    const buffer = await this.pdf.generarPdfVenta({
      emisor,
      tienda: ctx.nombre,
      sucursalNombre: venta.sucursal?.nombre,
      sucursalDireccion: venta.sucursal?.direccion,
      numero: venta.numero,
      fecha: venta.creadoEn,
      moneda: venta.moneda,
      clienteNombre: venta.cliente?.nombre ?? null,
      clienteDocumento: formatearDocumento(venta.cliente),
      vendedorNombre: venta.vendedor?.nombre ?? null,
      estado: venta.estado,
      notas: venta.notas,
      items: venta.items.map(it => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnitario: Number(it.precioUnitario),
        subtotal: Number(it.subtotal),
      })),
      subtotal: Number(venta.subtotal),
      descuento: Number(venta.descuento) + Number(venta.descuentoCupon),
      impuestos: Number(venta.impuestos),
      total: Number(venta.total),
      pagos: venta.pagos.map(p => ({ medio: p.medio, monto: Number(p.monto) })),
    });
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `inline; filename="${venta.numero}.pdf"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  }

  @Post() @RequierePermiso('ventas:crear')
  async crear(@Body() dto: CrearVentaDto, @Tenant() ctx: TenantContext, @Req() req: Request) {
    const venta = await this.service.crear(dto, ctx, req.usuario!.sub);
    return { datos: venta, mensaje: `Venta ${venta.numero} registrada` };
  }

  @Post(':id/anular') @RequierePermiso('ventas:anular')
  async anular(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const venta = await this.service.anular(id, body.motivo, ctx, req.usuario!.sub);
    return { datos: venta, mensaje: 'Venta anulada' };
  }

  @Post(':id/pagos') @RequierePermiso('ventas:crear')
  async registrarPago(
    @Param('id') id: string,
    @Body() body: { medio: string; monto: number; referencia?: string; sesionCajaId?: string },
    @Tenant() ctx: TenantContext,
    @Req() req: Request,
  ) {
    const datos = await this.service.registrarPago(id, body, ctx, req.usuario!.sub);
    return {
      datos,
      mensaje: datos.estado === 'pagada' ? 'Venta saldada' : 'Pago registrado',
    };
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
