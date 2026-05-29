import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ReporteVentasController } from './reporte-ventas.controller';
import { ReporteVentasService } from './reporte-ventas.service';
import { ReporteComprasController } from './reporte-compras.controller';
import { ReporteComprasService } from './reporte-compras.service';
import { ReporteInventarioController } from './reporte-inventario.controller';
import { ReporteInventarioService } from './reporte-inventario.service';
import { ReporteProveedoresController } from './reporte-proveedores.controller';
import { ReporteProveedoresService } from './reporte-proveedores.service';
import { ReporteClientesController } from './reporte-clientes.controller';
import { ReporteClientesService } from './reporte-clientes.service';
import { ReporteCajaController } from './reporte-caja.controller';
import { ReporteCajaService } from './reporte-caja.service';
import { ReporteProductosController } from './reporte-productos.controller';
import { ReporteProductosService } from './reporte-productos.service';
import { ReporteContabilidadController } from './reporte-contabilidad.controller';
import { ReporteContabilidadService } from './reporte-contabilidad.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    ReportesController,
    ReporteVentasController,
    ReporteComprasController,
    ReporteInventarioController,
    ReporteProveedoresController,
    ReporteClientesController,
    ReporteCajaController,
    ReporteProductosController,
    ReporteContabilidadController,
  ],
  providers: [
    ReportesService,
    ReporteVentasService,
    ReporteComprasService,
    ReporteInventarioService,
    ReporteProveedoresService,
    ReporteClientesService,
    ReporteCajaService,
    ReporteProductosService,
    ReporteContabilidadService,
  ],
})
export class ReportesModule {}
