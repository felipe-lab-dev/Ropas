# Ropas — ERP SaaS para tienda de ropa

Sistema de gestión interna (estilo ERP) para tiendas de venta de ropa, diseñado como **producto SaaS multi-tenant** dentro del catálogo del portal [ENKI](../../Enki/backend).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | **Next.js 16** (App Router) + **React 19** + **TypeScript** |
| UI | **shadcn/ui** + **Tailwind CSS v4** + **Framer Motion** |
| Backend | **NestJS 11** + **TypeScript** + **Pino** |
| ORM | **Prisma 6** (multi-schema) |
| Base de datos | **PostgreSQL 17** (Azure Flexible Server, Burstable B1ms) |
| Región Cloud | **Brazil South** |
| Multi-tenancy | **Schema-per-tenant** (`tenant_<code>` por cliente) |
| SaaS Provisioning | **ENKI** (API key + heartbeat + module gating) |

---

## Estructura del repo

```
Ropas/
├── backend/                # API NestJS
│   ├── prisma/             # Schema multi-tenant + migrations
│   ├── src/
│   │   ├── core/           # Multi-tenancy, auth, errors, logger
│   │   ├── saas/           # Cliente ENKI: bootstrap + heartbeat + gating
│   │   ├── modules/        # productos, ventas, inventario, caja, clientes…
│   │   └── main.ts
│   └── package.json
├── frontend/               # App Next.js
│   ├── app/                # Router + layouts + páginas
│   ├── components/         # shadcn/ui + custom
│   ├── lib/                # API client, hooks, utils
│   ├── styles/             # Tailwind config + design tokens
│   └── package.json
├── docs/                   # Especificaciones funcionales
├── infra/azure/            # Scripts az CLI para provisioning
└── .github/instructions/   # Reglas de código (estilo nueva_era)
```

---

## Setup local (resumen)

```bash
# Backend
cd backend
pnpm install
cp .env.example .env       # editar con conexión Postgres y datos ENKI
pnpm prisma migrate dev
pnpm dev

# Frontend (terminal aparte)
cd frontend
pnpm install
cp .env.example .env.local # editar NEXT_PUBLIC_API_URL
pnpm dev
```

Backend escucha en `http://localhost:3001`, frontend en `http://localhost:3000`.

---

## Documentación

- [docs/arquitectura.md](docs/arquitectura.md) — visión técnica completa
- [docs/multi-tenancy.md](docs/multi-tenancy.md) — schema-per-tenant en detalle
- [docs/integracion-enki.md](docs/integracion-enki.md) — provisioning, heartbeat, gating
- [docs/design-system.md](docs/design-system.md) — tokens, tipografía, componentes
- [.github/instructions/](.github/instructions/) — convenciones de código obligatorias

---

## Filosofía

> Sistema interno con UI brutal — porque es vitrina para futuros clientes SaaS.

Inspiración de UX y módulos: el ERP **nueva_era** (autopartes). Adaptado al stack Next.js + NestJS + Prisma + PostgreSQL y al dominio de venta de ropa (variantes por talla/color/material).
