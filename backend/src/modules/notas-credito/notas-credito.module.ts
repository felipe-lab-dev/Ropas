import { Module } from '@nestjs/common';
import { NotasCreditoController } from './notas-credito.controller';
import { NotasCreditoService } from './notas-credito.service';
import { AuthModule } from '../auth/auth.module';
import { InventarioModule } from '../inventario/inventario.module';
import { FacturacionElectronicaModule } from '../facturacion-electronica/facturacion-electronica.module';
import { ComprobanteInternoPdfModule } from '../comprobantes-internos/comprobante-interno-pdf.module';

@Module({
  imports: [
    AuthModule,
    InventarioModule,
    FacturacionElectronicaModule,
    ComprobanteInternoPdfModule,
  ],
  controllers: [NotasCreditoController],
  providers: [NotasCreditoService],
})
export class NotasCreditoModule {}
