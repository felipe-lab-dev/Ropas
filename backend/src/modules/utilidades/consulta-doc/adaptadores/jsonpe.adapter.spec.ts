/**
 * Tests del adaptador json.pe. Cubre los 4 casos obligatorios de la guía
 * (`docs/integracion-jsonpe.md`, sección 9): datos / sin_datos / error_tecnico /
 * fuera_de_servicio. HttpService se mockea con rxjs `of`/`throwError`, sin red real.
 */
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { JsonPeAdapter } from './jsonpe.adapter';

function axiosResp(data: unknown, status = 200): AxiosResponse {
  return {
    data,
    status,
    statusText: '',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
}

function httpMock(resp: AxiosResponse) {
  return { post: jest.fn().mockReturnValue(of(resp)) };
}

function configMock(token?: string, url?: string) {
  return {
    get: jest.fn((clave: string) => {
      if (clave === 'JSONPE_API_TOKEN') return token;
      if (clave === 'JSONPE_API_URL') return url;
      return undefined;
    }),
  };
}

const TOKEN = 'token-de-prueba';

describe('JsonPeAdapter', () => {
  // ── DNI ────────────────────────────────────────────────────────────────────
  describe('consultarDni', () => {
    it('DNI válido → tipo "datos" con nombre normalizado y header Bearer', async () => {
      const http = httpMock(
        axiosResp({
          success: true,
          data: {
            numero: '27427864',
            nombre_completo: 'CASTILLO TERRONES, JOSE PEDRO',
            nombres: 'JOSE PEDRO',
            apellido_paterno: 'CASTILLO',
            apellido_materno: 'TERRONES',
          },
        }),
      );
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarDni('27427864');

      expect(r.tipo).toBe('datos');
      if (r.tipo === 'datos') {
        expect(r.datos.dni).toBe('27427864');
        expect(r.datos.nombreCompleto).toBe('CASTILLO TERRONES, JOSE PEDRO');
        expect(r.datos.apellidoPaterno).toBe('CASTILLO');
      }
      expect(http.post).toHaveBeenCalledWith(
        'https://api.json.pe/api/dni',
        { dni: '27427864', numero: '27427864' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${TOKEN}`,
          }),
        }),
      );
    });

    it('DNI inexistente (HTTP 404) → tipo "sin_datos"', async () => {
      const http = httpMock(
        axiosResp({ success: false, message: 'No se encontró DNI' }, 404),
      );
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarDni('99999999');

      expect(r.tipo).toBe('sin_datos');
    });

    it('token rechazado (HTTP 401) → tipo "error_tecnico"', async () => {
      const http = httpMock(axiosResp({ message: 'Unauthorized' }, 401));
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarDni('27427864');

      expect(r.tipo).toBe('error_tecnico');
    });

    it('sin token configurado → tipo "fuera_de_servicio" y NO llama a la API', async () => {
      const http = httpMock(axiosResp({}, 200));
      const adapter = new JsonPeAdapter(
        http as never,
        configMock(undefined) as never,
      );

      const r = await adapter.consultarDni('27427864');

      expect(r.tipo).toBe('fuera_de_servicio');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('caída de red → tipo "error_tecnico"', async () => {
      const http = {
        post: jest
          .fn()
          .mockReturnValue(throwError(() => new Error('ECONNREFUSED'))),
      };
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarDni('27427864');

      expect(r.tipo).toBe('error_tecnico');
    });
  });

  // ── RUC ────────────────────────────────────────────────────────────────────
  describe('consultarRuc', () => {
    it('RUC válido → tipo "datos" con razón social normalizada', async () => {
      const http = httpMock(
        axiosResp({
          success: true,
          data: {
            ruc: '20552103816',
            nombre_o_razon_social: 'AGROLIGHT PERU S.A.C.',
            estado: 'ACTIVO',
            direccion_completa: 'PJ. JORGE BASADRE 158, LIMA',
            departamento: 'LIMA',
            provincia: 'LIMA',
            distrito: 'SANTA ANITA',
            ubigeo_sunat: '150137',
          },
        }),
      );
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarRuc('20552103816');

      expect(r.tipo).toBe('datos');
      if (r.tipo === 'datos') {
        expect(r.datos.razonSocial).toBe('AGROLIGHT PERU S.A.C.');
        expect(r.datos.estado).toBe('ACTIVO');
        expect(r.datos.ubigeo).toBe('150137');
      }
    });

    it('RUC con data vacía (200 sin razón social) → tipo "sin_datos"', async () => {
      const http = httpMock(
        axiosResp({ success: true, data: { ruc: '20000000000' } }, 200),
      );
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarRuc('20000000000');

      expect(r.tipo).toBe('sin_datos');
    });

    it('rate-limit (HTTP 429) → tipo "error_tecnico"', async () => {
      const http = httpMock(axiosResp({ message: 'Too Many Requests' }, 429));
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarRuc('20552103816');

      expect(r.tipo).toBe('error_tecnico');
    });
  });

  // ── Tipo de cambio ───────────────────────────────────────────────────────
  describe('consultarTipoCambio', () => {
    it('fecha válida → tipo "datos" con venta/compra normalizados y body+header correctos', async () => {
      const http = httpMock(
        axiosResp({
          success: true,
          data: {
            moneda: 'USD',
            fecha_sunat: '2024-01-15',
            venta: 3.696,
            compra: 3.69,
            sale: 3.696,
            purchase: 3.69,
          },
        }),
      );
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarTipoCambio('2024-01-15');

      expect(r.tipo).toBe('datos');
      if (r.tipo === 'datos') {
        expect(r.datos.venta).toBe(3.696);
        expect(r.datos.compra).toBe(3.69);
        expect(r.datos.moneda).toBe('USD');
        expect(r.datos.fecha).toBe('2024-01-15');
      }
      expect(http.post).toHaveBeenCalledWith(
        'https://api.json.pe/api/tipo_de_cambio',
        { fecha: '2024-01-15' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${TOKEN}`,
          }),
        }),
      );
    });

    it('payload solo con sale/purchase (inglés) → normaliza a venta/compra', async () => {
      const http = httpMock(
        axiosResp({ data: { sale: 3.7, purchase: 3.65, fecha_sunat: '2024-02-01' } }),
      );
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarTipoCambio('2024-02-01');

      expect(r.tipo).toBe('datos');
      if (r.tipo === 'datos') {
        expect(r.datos.venta).toBe(3.7);
        expect(r.datos.compra).toBe(3.65);
      }
    });

    it('HTTP 400 inválido → tipo "error_tecnico"', async () => {
      const http = httpMock(axiosResp({ success: false, message: 'Bad Request' }, 400));
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarTipoCambio('2024-01-15');

      expect(r.tipo).toBe('error_tecnico');
    });

    it('HTTP 404 de fuente → tipo "error_tecnico" (NO sin_datos)', async () => {
      const http = httpMock(axiosResp({ success: false }, 404));
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarTipoCambio('2024-01-15');

      expect(r.tipo).toBe('error_tecnico');
    });

    it('caída de red → tipo "error_tecnico"', async () => {
      const http = {
        post: jest
          .fn()
          .mockReturnValue(throwError(() => new Error('ETIMEDOUT'))),
      };
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarTipoCambio('2024-01-15');

      expect(r.tipo).toBe('error_tecnico');
    });

    it('sin token → tipo "fuera_de_servicio" y NO llama a la API', async () => {
      const http = httpMock(axiosResp({}, 200));
      const adapter = new JsonPeAdapter(http as never, configMock(undefined) as never);

      const r = await adapter.consultarTipoCambio('2024-01-15');

      expect(r.tipo).toBe('fuera_de_servicio');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('fecha mal formateada → tipo "error_tecnico" sin llamar a la red', async () => {
      const http = httpMock(axiosResp({}, 200));
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      const r = await adapter.consultarTipoCambio('15/01/2024');

      expect(r.tipo).toBe('error_tecnico');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('sin fecha → usa la de hoy en formato YYYY-MM-DD', async () => {
      const http = httpMock(
        axiosResp({ data: { venta: 3.8, compra: 3.75, moneda: 'USD' } }),
      );
      const adapter = new JsonPeAdapter(http as never, configMock(TOKEN) as never);

      await adapter.consultarTipoCambio();

      const body = (http.post as jest.Mock).mock.calls[0][1] as { fecha: string };
      expect(body.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
