# Arquitectura — Ropas

## Vista de alto nivel

```
                                    ┌─────────────────────┐
                                    │       ENKI          │
                                    │  Portal SaaS        │
                                    │  (Express + PG)     │
                                    └──────────┬──────────┘
                                               │ provisiona schema
                                               │ valida API key
                                               │ recibe heartbeat
                                               │
┌──────────────────┐     HTTPS      ┌─────────▼───────────┐     pgwire     ┌──────────────────────┐
│  Frontend        │ ◄────────────► │  Backend            │ ◄────────────► │  PostgreSQL          │
│  Next.js 16      │   X-Tenant     │  NestJS 11          │  search_path   │  Azure Flexible B1ms │
│  React 19        │   X-Auth       │  Prisma 6           │  tenant_<code> │  brazilsouth         │
└──────────────────┘                └─────────────────────┘                └──────────────────────┘
```

## Componentes

### Backend (NestJS)

```
backend/src/
├── core/
│   ├── tenancy/             # PrismaTenantService, decorador @Tenant, middleware
│   ├── auth/                # JWT, guards, decoradores @RequierePermiso
│   ├── errors/              # ErrorAplicacion + filter global
│   ├── pagination/          # helpers paginación
│   ├── logger/              # Pino config
│   └── responses/           # respuestaExito, respuestaPaginada
├── saas/                    # Cliente ENKI: bootstrap, heartbeat, config caché, gating
├── modules/
│   ├── productos/
│   ├── inventario/
│   ├── ventas/
│   ├── caja/
│   ├── clientes/
│   ├── proveedores/
│   ├── compras/
│   ├── reportes/
│   ├── usuarios/
│   └── configuracion/
├── prisma/                  # Wrapper del cliente
└── main.ts
```

### Frontend (Next.js)

```
frontend/
├── app/
│   ├── (auth)/login/        # Pantalla de login
│   ├── (shell)/             # Layout con sidebar + header + comandos
│   │   ├── page.tsx         # Dashboard
│   │   ├── productos/
│   │   ├── ventas/
│   │   │   └── pos/         # POS de venta rápida
│   │   ├── inventario/
│   │   ├── caja/
│   │   ├── clientes/
│   │   ├── reportes/
│   │   └── configuracion/
│   ├── layout.tsx           # Root layout: ThemeProvider, fonts
│   └── globals.css
├── components/
│   ├── ui/                  # shadcn/ui (Button, Dialog, Table, …)
│   ├── shell/               # Sidebar, Header, CommandPalette
│   ├── data-table/          # Wrapper TanStack Table + paginación
│   └── forms/               # FieldsTextoNumero, FormShell
├── lib/
│   ├── api/                 # cliente fetch tipado contra backend
│   ├── auth/                # session, token storage
│   ├── search/              # word-split helper
│   └── utils.ts             # cn, format
└── styles/
    └── tokens.css           # variables HSL del design system
```

## Flujo de un request

1. Browser → `GET /api/v1/productos` (incluye `Authorization: Bearer <jwt>`, `X-Tenant-Code: mi-tienda`)
2. Frontend Next.js → reenvía vía `lib/api/client.ts` al backend (`http://api.ropas.local/api/v1/productos`)
3. Backend NestJS:
   - `TenantMiddleware` lee header → resuelve schema `tenant_mi_tienda`
   - `AuthGuard` valida JWT → llena `req.usuario`
   - `ModuloHabilitadoGuard` revisa cache de ENKI → ¿`productos` está en plan?
   - `RequierePermisoGuard` revisa `req.usuario.permisos` incluye `productos:leer`
   - Controller delega a `ProductoService.listar({...}, ctx)`
   - Service llama `prisma.forTenant(ctx).producto.findMany({...})`
   - Retorna `{ exito, datos, total, pagina, limite, totalPaginas }`

## Multi-tenancy

Ver [multi-tenancy.md](multi-tenancy.md).

## Integración ENKI

Ver [integracion-enki.md](integracion-enki.md).

## Convenciones

Ver [.github/instructions/](../.github/instructions/) — backend, ui, rules.
