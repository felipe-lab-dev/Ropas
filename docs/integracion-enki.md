# Integración con ENKI

## Resumen

ENKI es el portal SaaS que provisiona, factura y monitorea a los clientes que contratan Ropas. Ropas se integra con ENKI vía:

1. **Bootstrap**: al iniciar, lee config del tenant (módulos habilitados, plan, límites).
2. **Heartbeat**: reporta cada 5 min su salud y métricas.
3. **Module gating**: solo expone endpoints/UI de los módulos que el plan incluye.

ENKI **no** es un identity provider. Cada producto (incluido Ropas) maneja su propia auth de usuarios finales.

## Endpoints de ENKI consumidos

Base URL: `ENKI_BASE_URL` (ej. `https://enki.midominio.com`).
Header obligatorio: `X-Enki-Api-Key: enki_live_<...>` (recibida al provisionar el tenant).

### `GET /api/v1/saas/tenants/{tenantCode}/config`

```json
{
  "tenant": { "id": "...", "code": "mi-tienda", "nombre": "Mi Tienda S.A.C.", "estado": "activo" },
  "plan": { "id": "...", "nombre": "Profesional", "limites": { "maxUsuarios": 5, "maxProductos": 5000 } },
  "modulosHabilitados": ["productos", "inventario", "ventas", "caja", "clientes", "reportes"],
  "accesoPermitido": true,
  "fechaFinTrial": null,
  "webhookUrl": "https://enki.midominio.com/webhook/saas/mi-tienda"
}
```

Cacheado en memoria 5 min (TTL configurable). Al primer fallo de `accesoPermitido=false`, todo request responde 402/403 con JSON estándar.

### `POST /api/v1/saas/tenants/{tenantCode}/sistemas/{sistemaId}/heartbeat`

```json
{
  "version": "1.0.0",
  "timestamp": "2026-05-15T10:00:00Z",
  "metricas": {
    "usuariosActivos": 2,
    "productos": 1245,
    "ventasHoy": 18,
    "uptime": 86400
  }
}
```

## Configuración (env vars)

```
# .env del backend Ropas
ENKI_BASE_URL=https://enki.midominio.com
ENKI_API_KEY=enki_live_xxxxxxxxxxxxxxxxxxxxxxxx
ENKI_TENANT_CODE=mi-tienda
ENKI_SISTEMA_ID=uuid-del-sistema-en-enki
ENKI_HEARTBEAT_INTERVAL_MS=300000   # 5 min
ENKI_OFFLINE=false                  # true en dev → bootstrap con todo habilitado
```

## Implementación en NestJS

### `src/saas/saas.module.ts`

```ts
@Module({
  imports: [HttpModule, ScheduleModule.forRoot()],
  providers: [
    EnkiClient,
    SaasConfigCacheService,
    SaasBootstrapService,
    HeartbeatService,
    ModuloHabilitadoGuard,
  ],
  exports: [SaasConfigCacheService, ModuloHabilitadoGuard],
})
export class SaasModule {}
```

### `EnkiClient`

Wrapper Axios con interceptor que inyecta `X-Enki-Api-Key`. Retorna tipos zod-validated.

### `SaasBootstrapService.onApplicationBootstrap()`

Llama `GET /config`, popula cache. Si `ENKI_OFFLINE=true` → genera config falsa con todos los módulos.

### `HeartbeatService` (`@Cron(EVERY_5_MINUTES)`)

POSTea heartbeat al endpoint de ENKI con métricas frescas.

### Guard `ModuloHabilitadoGuard`

```ts
@Injectable()
export class ModuloHabilitadoGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private cache: SaasConfigCacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const modulo = this.reflector.get<string>('modulo', ctx.getHandler())
                ?? this.reflector.get<string>('modulo', ctx.getClass());
    if (!modulo) return true;

    const config = await this.cache.obtener();
    if (!config.modulosHabilitados.includes(modulo)) {
      throw new ErrorProhibido(`Módulo "${modulo}" no incluido en tu plan`);
    }
    return true;
  }
}
```

Decorador asociado:

```ts
export const ModuloHabilitado = (modulo: string) => SetMetadata('modulo', modulo);
```

### Frontend gating

El frontend pide `GET /api/v1/saas/mi-config` al backend (que es proxy de la cache local). El sidebar y comandos Ctrl+K filtran items según `modulosHabilitados`. Si `accesoPermitido=false`, redirige a `/suscripcion-suspendida`.

## Modo dev sin ENKI

Setear `ENKI_OFFLINE=true` en `.env`. Bootstrap genera config con TODOS los módulos habilitados, sin límites. Ideal para desarrollar features nuevas sin depender del portal.
