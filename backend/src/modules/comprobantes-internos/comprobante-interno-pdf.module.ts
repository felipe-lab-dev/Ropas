import { Module } from '@nestjs/common';
import { ComprobanteInternoPdfService } from './comprobante-interno-pdf.service';
import { EmisorInternoService } from './emisor-interno.service';

/**
 * Provee el render de comprobantes internos (PDF de nota de venta y de NC
 * interna) y el resolutor de datos del emisor. Lo importan VentasModule y
 * NotasCreditoModule para exponer sus endpoints `:id/pdf-interno`.
 */
@Module({
  providers: [ComprobanteInternoPdfService, EmisorInternoService],
  exports: [ComprobanteInternoPdfService, EmisorInternoService],
})
export class ComprobanteInternoPdfModule {}
