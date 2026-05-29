import { Provider } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  PROVEEDOR_CONSULTA_DOC,
  ProveedorConsultaDoc,
} from './proveedor-consulta-doc.puerto';
import { JsonPeAdapter } from './adaptadores/jsonpe.adapter';

/**
 * FÁBRICA. Elige el adaptador activo según `API_PROVEEDOR` (default `jsonpe`).
 *
 * El día que entre factiliza: crear su adaptador y sumar un `case` acá. Cambiar
 * de proveedor = una línea en el `.env` (`API_PROVEEDOR=factiliza`), cero cambios
 * en controllers ni features. Ver `docs/integracion-jsonpe.md` (sección 8).
 */
export const proveedorConsultaDocProvider: Provider = {
  provide: PROVEEDOR_CONSULTA_DOC,
  useFactory: (
    http: HttpService,
    config: ConfigService,
  ): ProveedorConsultaDoc => {
    const elegido = (
      config.get<string>('API_PROVEEDOR') ?? 'jsonpe'
    ).toLowerCase();
    switch (elegido) {
      case 'jsonpe':
        return new JsonPeAdapter(http, config);
      // case 'factiliza': return new FactilizaAdapter(http, config); // futuro
      default:
        return new JsonPeAdapter(http, config);
    }
  },
  inject: [HttpService, ConfigService],
};
