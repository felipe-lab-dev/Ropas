import { Module } from '@nestjs/common';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';
import { AuthModule } from '../auth/auth.module';
import { InventarioModule } from '../inventario/inventario.module';
import { CuponesModule } from '../cupones/cupones.module';
import { FacturacionElectronicaModule } from '../facturacion-electronica/facturacion-electronica.module';
import { ComprobanteInternoPdfModule } from '../comprobantes-internos/comprobante-interno-pdf.module';

@Module({
  imports: [
    AuthModule,
    InventarioModule,
    CuponesModule,
    FacturacionElectronicaModule,
    ComprobanteInternoPdfModule,
  ],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
