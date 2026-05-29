import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UtilidadesController } from './utilidades.controller';
import { AuthModule } from '../auth/auth.module';
import { PROVEEDOR_CONSULTA_DOC } from './consulta-doc/proveedor-consulta-doc.puerto';
import { proveedorConsultaDocProvider } from './consulta-doc/proveedor-consulta-doc.factory';

/**
 * Subsistema de consulta de documentos (DNI/RUC) desacoplado.
 *
 * El controller consume el PUERTO por token; el adaptador concreto lo decide el
 * factory según `API_PROVEEDOR`. Se exporta el token por si otro módulo necesita
 * consultar (ej. importar proveedores/clientes en lote).
 */
@Module({
  imports: [HttpModule.register({ timeout: 8000 }), AuthModule],
  controllers: [UtilidadesController],
  providers: [proveedorConsultaDocProvider],
  exports: [PROVEEDOR_CONSULTA_DOC],
})
export class UtilidadesModule {}
