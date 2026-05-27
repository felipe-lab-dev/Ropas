/**
 * Tests unitarios de PollEstadosCpeCron.
 *
 * No hay NestJS runtime, no hay DB, no hay HTTP.
 * Todos los colaboradores se mockean con jest.fn().
 *
 * Patrón de construcción:
 *   - prismaPublic: mock con tenant.findMany
 *   - prismaTenancy: mock con forTenant() que retorna un prisma de tenant mockeado
 *   - crearDocSvc: factory mockeado (sin args) que retorna un DocumentoElectronicoService mockeado
 *
 * Luego instanciamos el cron como POJO (sin DI de NestJS) y lo ejercemos.
 */
import { PollEstadosCpeCron } from './poll-estados-cpe.cron';
import type { DocumentoElectronicoService } from '../documento-electronico/documento-electronico.service';
import type { TenantContext } from '../../../core/tenancy/tenant-context';

// ─── Factories de mocks ───────────────────────────────────────────────────────

function crearMockDocSvc(): jest.Mocked<Pick<DocumentoElectronicoService, 'consultarEstadoCpe'>> {
  return {
    consultarEstadoCpe: jest.fn().mockResolvedValue({}),
  };
}

function crearMockPrismaTenant(docs: { ventaId: string; id: string }[] = []) {
  return {
    documentoElectronico: {
      findMany: jest.fn().mockResolvedValue(docs),
    },
  };
}

function crearMockPrismaPublic(
  tenants: { codigo: string; schemaName: string; nombre: string }[] = [],
) {
  return {
    tenant: {
      findMany: jest.fn().mockResolvedValue(tenants),
    },
  };
}

function crearMockPrismaTenancy(prismaTenant: ReturnType<typeof crearMockPrismaTenant>) {
  return {
    forTenant: jest.fn().mockReturnValue(prismaTenant),
  };
}

/**
 * Crea una instancia de PollEstadosCpeCron como POJO con todos los deps mockeados.
 * La factory no recibe argumentos — el DocumentoElectronicoService usa PrismaTenantService
 * que ya tiene el tenant resuelto.
 */
function crearCron(options: {
  tenants?: { codigo: string; schemaName: string; nombre: string }[];
  docsPorTenant?: Record<string, { ventaId: string; id: string }[]>;
  mockDocSvc?: jest.Mocked<Pick<DocumentoElectronicoService, 'consultarEstadoCpe'>>;
}) {
  const tenants = options.tenants ?? [];
  const docsPorTenant = options.docsPorTenant ?? {};
  const mockDocSvc = options.mockDocSvc ?? crearMockDocSvc();

  // Un prismaTenant diferente por tenant (permite distintos docs por tenant)
  const prismasTenant: Record<string, ReturnType<typeof crearMockPrismaTenant>> = {};
  for (const t of tenants) {
    prismasTenant[t.codigo] = crearMockPrismaTenant(docsPorTenant[t.codigo] ?? []);
  }

  const prismaPublic = crearMockPrismaPublic(tenants);
  const prismaTenancy = {
    forTenant: jest.fn().mockImplementation((ctx: { codigo: string }) => {
      return prismasTenant[ctx.codigo] ?? crearMockPrismaTenant();
    }),
  };
  // La factory ya no recibe prisma — simplemente retorna el mockDocSvc
  const crearDocSvc = jest.fn().mockReturnValue(mockDocSvc);

  const cron = new PollEstadosCpeCron(
    prismaPublic as never,
    prismaTenancy as never,
    crearDocSvc as never,
  );

  return { cron, prismaPublic, prismaTenancy, prismasTenant, crearDocSvc, mockDocSvc };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PollEstadosCpeCron', () => {
  describe('barrer() — anti-overlap', () => {
    it('4. no ejecuta si el barrido anterior está en curso', async () => {
      // La primera llamada bloquea ejecutar() indefinidamente mientras la segunda llega.
      // Usamos una promesa que podemos resolver manualmente para controlar el timing.
      let resolverEjecucion!: () => void;
      const primeraEjecucion = new Promise<void>((resolve) => {
        resolverEjecucion = resolve;
      });

      const prismaPublic = crearMockPrismaPublic([]);
      // Hacemos que findMany cuelgue hasta que lo resolvamos
      (prismaPublic.tenant.findMany as jest.Mock).mockReturnValueOnce(primeraEjecucion.then(() => []));

      const prismaTenancy = crearMockPrismaTenancy(crearMockPrismaTenant());
      const crearDocSvc = jest.fn();

      const cron = new PollEstadosCpeCron(
        prismaPublic as never,
        prismaTenancy as never,
        crearDocSvc as never,
      );

      // Primera llamada — bloquea
      const primeraLlamada = cron.barrer();
      // Segunda llamada — debe retornar inmediatamente sin ejecutar (corriendo=true)
      await cron.barrer();

      // findMany solo debe haberse llamado UNA vez (la segunda iteración saltó)
      expect(prismaPublic.tenant.findMany).toHaveBeenCalledTimes(1);

      // Desbloquear la primera ejecución y esperar que termine limpiamente
      resolverEjecucion();
      await primeraLlamada;
    });
  });

  describe('ejecutar() — lógica principal', () => {
    it('1. sin tenants: no llama consultarEstadoCpe ni lanza error', async () => {
      const { cron, mockDocSvc } = crearCron({ tenants: [] });

      await expect(cron.barrer()).resolves.toBeUndefined();
      expect(mockDocSvc.consultarEstadoCpe).not.toHaveBeenCalled();
    });

    it('2. tenant sin docs en_proceso: no llama consultarEstadoCpe', async () => {
      const tenants = [{ codigo: 'tienda-a', schemaName: 'tenant_tienda_a', nombre: 'Tienda A' }];
      const { cron, mockDocSvc } = crearCron({ tenants, docsPorTenant: { 'tienda-a': [] } });

      await cron.barrer();

      expect(mockDocSvc.consultarEstadoCpe).not.toHaveBeenCalled();
    });

    it('3. happy path: 2 tenants (3 docs + 1 doc) → 4 llamadas a consultarEstadoCpe', async () => {
      const tenants = [
        { codigo: 'tienda-a', schemaName: 'tenant_tienda_a', nombre: 'Tienda A' },
        { codigo: 'tienda-b', schemaName: 'tenant_tienda_b', nombre: 'Tienda B' },
      ];
      const docsPorTenant = {
        'tienda-a': [
          { ventaId: 'venta-1', id: 'doc-1' },
          { ventaId: 'venta-2', id: 'doc-2' },
          { ventaId: 'venta-3', id: 'doc-3' },
        ],
        'tienda-b': [
          { ventaId: 'venta-4', id: 'doc-4' },
        ],
      };
      const mockDocSvc = crearMockDocSvc();
      const { cron } = crearCron({ tenants, docsPorTenant, mockDocSvc });

      await cron.barrer();

      expect(mockDocSvc.consultarEstadoCpe).toHaveBeenCalledTimes(4);
      // Each call receives (ctx, ventaId)
      const calls = (mockDocSvc.consultarEstadoCpe as jest.Mock).mock.calls;
      const ventaIds = calls.map((c: unknown[]) => c[1]);
      expect(ventaIds).toContain('venta-1');
      expect(ventaIds).toContain('venta-2');
      expect(ventaIds).toContain('venta-3');
      expect(ventaIds).toContain('venta-4');
    });

    it('5. error en un tenant no interrumpe el procesamiento del siguiente', async () => {
      const tenants = [
        { codigo: 'tienda-err', schemaName: 'tenant_tienda_err', nombre: 'Tienda Error' },
        { codigo: 'tienda-ok', schemaName: 'tenant_tienda_ok', nombre: 'Tienda OK' },
      ];

      const mockDocSvc = crearMockDocSvc();
      const prismaPublic = crearMockPrismaPublic(tenants);
      const prismaTenantErr = crearMockPrismaTenant([]);
      const prismaTenantOk = crearMockPrismaTenant([{ ventaId: 'venta-ok', id: 'doc-ok' }]);

      // El primer tenant lanza error en findMany
      (prismaTenantErr.documentoElectronico.findMany as jest.Mock).mockRejectedValueOnce(
        new Error('Error de conexión'),
      );

      const prismaTenancy = {
        forTenant: jest.fn().mockImplementation((ctx: { codigo: string }) => {
          if (ctx.codigo === 'tienda-err') return prismaTenantErr;
          return prismaTenantOk;
        }),
      };
      const crearDocSvc = jest.fn().mockReturnValue(mockDocSvc);

      const cron = new PollEstadosCpeCron(
        prismaPublic as never,
        prismaTenancy as never,
        crearDocSvc as never,
      );

      await expect(cron.barrer()).resolves.toBeUndefined();

      // El segundo tenant (ok) sí se procesó
      expect(mockDocSvc.consultarEstadoCpe).toHaveBeenCalledTimes(1);
      const calls = (mockDocSvc.consultarEstadoCpe as jest.Mock).mock.calls;
      expect(calls[0][1]).toBe('venta-ok');
    });

    it('6. error en un doc no interrumpe el procesamiento del siguiente doc', async () => {
      const tenants = [
        { codigo: 'tienda-a', schemaName: 'tenant_tienda_a', nombre: 'Tienda A' },
      ];
      const docsPorTenant = {
        'tienda-a': [
          { ventaId: 'venta-1', id: 'doc-1' },
          { ventaId: 'venta-2', id: 'doc-2' },
        ],
      };
      const mockDocSvc = crearMockDocSvc();

      // El primer doc falla, el segundo debe procesarse igual
      (mockDocSvc.consultarEstadoCpe as jest.Mock)
        .mockRejectedValueOnce(new Error('Mifact timeout'))
        .mockResolvedValueOnce({});

      const { cron } = crearCron({ tenants, docsPorTenant, mockDocSvc });

      await expect(cron.barrer()).resolves.toBeUndefined();

      expect(mockDocSvc.consultarEstadoCpe).toHaveBeenCalledTimes(2);
      const calls = (mockDocSvc.consultarEstadoCpe as jest.Mock).mock.calls;
      expect(calls[0][1]).toBe('venta-1');
      expect(calls[1][1]).toBe('venta-2');
    });

    it('skips docs sin ventaId (notas de crédito)', async () => {
      const tenants = [
        { codigo: 'tienda-a', schemaName: 'tenant_tienda_a', nombre: 'Tienda A' },
      ];
      const docsPorTenant = {
        'tienda-a': [
          { ventaId: null as unknown as string, id: 'doc-nc' },
          { ventaId: 'venta-1', id: 'doc-1' },
        ],
      };
      const mockDocSvc = crearMockDocSvc();
      const { cron } = crearCron({ tenants, docsPorTenant, mockDocSvc });

      await cron.barrer();

      // Solo se llama para el doc con ventaId
      expect(mockDocSvc.consultarEstadoCpe).toHaveBeenCalledTimes(1);
      const calls = (mockDocSvc.consultarEstadoCpe as jest.Mock).mock.calls;
      expect(calls[0][1]).toBe('venta-1');
    });

    it('consulta solo tenants activo/trial (no suspendidos ni cancelados)', async () => {
      const { cron, prismaPublic } = crearCron({ tenants: [] });

      await cron.barrer();

      expect(prismaPublic.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: { in: ['activo', 'trial'] },
            eliminadoEn: null,
          }),
        }),
      );
    });

    it('pasa el ctx correcto a consultarEstadoCpe', async () => {
      const tenants = [
        { codigo: 'mi-tienda', schemaName: 'tenant_mi_tienda', nombre: 'Mi Tienda' },
      ];
      const docsPorTenant = {
        'mi-tienda': [{ ventaId: 'venta-1', id: 'doc-1' }],
      };
      const mockDocSvc = crearMockDocSvc();
      const { cron } = crearCron({ tenants, docsPorTenant, mockDocSvc });

      await cron.barrer();

      const ctxPasado = (mockDocSvc.consultarEstadoCpe as jest.Mock).mock.calls[0][0] as TenantContext;
      expect(ctxPasado.codigo).toBe('mi-tienda');
      expect(ctxPasado.schemaName).toBe('tenant_mi_tienda');
    });
  });
});
