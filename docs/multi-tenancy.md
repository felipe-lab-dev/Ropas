# Multi-tenancy — schema-per-tenant

## Modelo

Una sola **base de datos** PostgreSQL (`ropas`) con N schemas:

| Schema | Contenido |
|--------|-----------|
| `public` | Metadata global: `tenants`, `tenant_jobs`, `tenant_audit`. Solo lo lee/escribe `core/tenancy`. |
| `tenant_<code>` | Datos del cliente: productos, ventas, inventario, etc. Un schema por cliente. |

## Por qué schema-per-tenant

- **Aislamiento fuerte** sin separar instancias (B1ms es chico, no nos podemos dar el lujo de N servidores).
- **Backup por cliente** trivial (`pg_dump --schema=tenant_xxx`).
- **Queries cruzadas** son posibles si se necesitan métricas globales.
- Prisma 6 soporta multi-schema con `previewFeatures = ["multiSchema"]` y `@@schema("...")`.

## Cómo se resuelve el schema

1. Cada request al backend trae `X-Tenant-Code: <code>` (ej. `mi-tienda`).
2. `TenantMiddleware` (NestJS):
   - Valida que el tenant exista en `public.tenants` y esté activo.
   - Carga config cacheada de ENKI (`saas/config-cache.service.ts`).
   - Inyecta `req.tenant: TenantContext = { code, schema, plan, modulosHabilitados, ... }`.
3. `PrismaTenantService.forTenant(ctx)`:
   - Devuelve un `PrismaClient` con `datasources.db.url` apuntando al schema:
     ```
     postgres://user:pass@host/ropas?schema=tenant_<code>
     ```
   - Internamente cachea instancias por código de tenant (LRU para no abrir miles).

## Bootstrap de un tenant nuevo

Disparado desde ENKI vía `POST /api/v1/admin/saas/provisionar-cliente`. ENKI ejecuta los scripts `infra/azure/sql/init-tenant.sql` que:

1. `CREATE SCHEMA tenant_<code>`
2. Aplica las migraciones Prisma equivalentes al schema (idempotente)
3. Inserta seed: `roles` por defecto, `categorias` base de ropa (camisa, pantalón, etc.), `unidades`, `monedas`, `usuario admin` con password temporal

Alternativamente, en dev local, hay script:

```bash
pnpm --dir backend tenant:crear -- --code mi-tienda --nombre "Mi Tienda Demo"
```

que hace lo mismo localmente sin pasar por ENKI.

## Migrations

- Una sola fuente de verdad: `backend/prisma/schema.prisma`.
- En dev: `prisma migrate dev` aplica migrations al schema `public` y a un schema "template" (`tenant_template`).
- El bootstrap de un tenant copia/aplica el DDL al schema nuevo.
- En prod: cuando hay un cambio de schema, hay job `migrate:tenants` que itera sobre todos los tenants activos y aplica las migrations pendientes (con advisory lock para serializar).

## Auditoría cross-schema

`public.tenant_audit` recibe eventos importantes (creación de tenant, cambios de plan, suspensiones). El audit por entidad de negocio vive en cada schema (`tenant_<code>.audit_log`).
