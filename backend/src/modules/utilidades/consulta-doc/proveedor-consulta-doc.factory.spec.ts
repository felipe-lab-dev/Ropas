/**
 * Verifica el cableado de inyección de dependencias del subsistema: que Nest
 * resuelva el token PROVEEDOR_CONSULTA_DOC a un adaptador concreto usando el
 * factory (resolviendo HttpService + ConfigService del `inject`). Esto atrapa
 * fallos de DI que `tsc` no ve (token mal, inject mal armado).
 */
import { Test } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { proveedorConsultaDocProvider } from './proveedor-consulta-doc.factory';
import {
  PROVEEDOR_CONSULTA_DOC,
  ProveedorConsultaDoc,
} from './proveedor-consulta-doc.puerto';

describe('proveedorConsultaDocProvider (DI)', () => {
  it('Nest resuelve el token a un adaptador con el contrato del puerto', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule.register({ timeout: 8000 }),
        ConfigModule.forRoot({ ignoreEnvFile: true }),
      ],
      providers: [proveedorConsultaDocProvider],
    }).compile();

    const proveedor = moduleRef.get<ProveedorConsultaDoc>(
      PROVEEDOR_CONSULTA_DOC,
    );

    expect(proveedor.nombre).toBe('json.pe');
    expect(typeof proveedor.consultarDni).toBe('function');
    expect(typeof proveedor.consultarRuc).toBe('function');
    // Sin token configurado, el contrato exige degradar a fuera_de_servicio.
    const r = await proveedor.consultarDni('27427864');
    expect(r.tipo).toBe('fuera_de_servicio');

    await moduleRef.close();
  });
});
