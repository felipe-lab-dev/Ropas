import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';

import { CoreModule } from './core/core.module';
import { SaasModule } from './saas/saas.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductosModule } from './modules/productos/productos.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { CajaModule } from './modules/caja/caja.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { SucursalesModule } from './modules/sucursales/sucursales.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { ComprasModule } from './modules/compras/compras.module';
import { ContabilidadModule } from './modules/contabilidad/contabilidad.module';
import { PreferenciasModule } from './modules/preferencias/preferencias.module';
import { CuponesModule } from './modules/cupones/cupones.module';
import { NotasCreditoModule } from './modules/notas-credito/notas-credito.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'HH:MM:ss',
                  ignore: 'pid,hostname,req,res,responseTime,context',
                  messageFormat: '{context} | {msg}',
                },
              },
        redact: ['req.headers.authorization', 'req.headers["x-enki-api-key"]'],
      },
    }),
    ScheduleModule.forRoot(),
    CoreModule,
    SaasModule,
    AuthModule,
    SucursalesModule,
    CategoriasModule,
    ProductosModule,
    InventarioModule,
    VentasModule,
    CajaModule,
    ClientesModule,
    ProveedoresModule,
    ComprasModule,
    ContabilidadModule,
    ReportesModule,
    ConfiguracionModule,
    PreferenciasModule,
    CuponesModule,
    NotasCreditoModule,
  ],
})
export class AppModule {}
