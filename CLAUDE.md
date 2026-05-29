# CLAUDE.md — Guía para Claude Code en el repo Ropas

Este archivo es leído automáticamente por Claude Code al iniciar sesión en este repo. Contiene reglas globales que **toda generación de código debe respetar**.

---

## Identidad del proyecto

**Ropas** es un ERP SaaS multi-tenant para venta de ropa, gestionado por el portal ENKI. Stack: **Next.js 16 + React 19** (frontend) y **NestJS 11 + Prisma + PostgreSQL** (backend). Multi-tenancy: **schema-per-tenant**.

Detalles vivos en `README.md`, `docs/arquitectura.md` y memorias en `.claude/memory/`.

---

## Reglas globales (NO negociables)

1. **Idioma del dominio: español.** Nombres de entidades, campos, tablas, rutas API, mensajes al usuario. Solo el inglés se permite en términos puramente técnicos (`request`, `response`, `boolean`).
2. **Soft delete global**: cada modelo Prisma incluye `eliminadoEn DateTime?`. Toda query de lectura filtra por `eliminadoEn: null`. Nunca borrar físicamente.
3. **Multi-tenancy obligatorio**: cada request al backend lleva header `X-Tenant-Code`. El middleware resuelve schema vía Prisma + `SET search_path`. Ningún service consulta la DB sin pasar por el TenantContext.
4. **Respuesta API estándar**:
   - Éxito: `{ exito: true, datos: <T>, mensaje?: string }`
   - Paginado: `{ exito: true, datos: T[], total, pagina, limite, totalPaginas }`
   - Error: `{ exito: false, mensaje: string, errores?: { campo, mensaje }[] }`
5. **Errores tipados** (NestJS exception filter): `ErrorNoEncontrado` (404), `ErrorValidacion` (400), `ErrorNoAutorizado` (401), `ErrorProhibido` (403), `ErrorConflicto` (409). Heredan de `ErrorAplicacion`.
6. **Permisos**: formato `modulo:accion` (ej. `productos:crear`). Decorador `@RequierePermiso('ventas:crear')`.
7. **Module gating ENKI**: cada controller protegido por `@ModuloHabilitado('ventas')`. Si ENKI no tiene el módulo en el plan → 403.
8. **Naming**:
   - Archivos: `kebab-case.ts` (ej. `crear-venta.dto.ts`, `producto.service.ts`)
   - Clases: `PascalCase`
   - Variables/campos: `camelCase` (`sucursalId`, `precioVenta`)
   - Rutas API: `/api/v1/kebab-case` en español (`/api/v1/notas-credito`)
9. **Validación con Zod** en DTOs (compartido con frontend si conviene).
10. **Logs estructurados**: Pino. Nunca `console.log`. Nivel `info` para acciones de negocio, `error` para excepciones.

---

## Reglas de UI (frontend)

Ver `.github/instructions/ui.instructions.md` para detalle completo. Resumen:

- **Dark mode primero**, light mode soportado. Toggle persiste en localStorage.
- **Tipografía dinámica** (Inter/Geist por default) — usuario puede cambiar familia y tamaño en Configuración.
- **Tablas profesionales**: paginadas, expandibles, con iconos vía clases CSS, sin SVG inline en acciones.
- **Buscador global Ctrl+K**: registra cada módulo y sus tabs.
- **Word-split search** en inputs. Atajo `Shift+Space` limpia el buscador.
- **Animaciones con Framer Motion**: entradas suaves (fade + slide), no más de 250ms.
- **Ningún `any`** en TS. Usar `unknown` + narrowing si es estrictamente necesario.
- **Componentes shadcn/ui** como base. Si necesitas algo no incluido, crearlo en `components/ui/` siguiendo su patrón (Radix + cva).

---

## Comandos útiles

```bash
# Backend
cd backend
pnpm dev                    # NestJS en watch (puerto 3001)
pnpm prisma migrate dev     # Migración + generación cliente
pnpm prisma studio          # GUI de la DB
pnpm test                   # Jest

# Frontend
cd frontend
pnpm dev                    # Next.js en :3000
pnpm lint
pnpm build

# E2E (Playwright)
cd frontend
NEXT_E2E=1 pnpm dev         # Frontend en modo E2E (StrictMode off para Playwright)
E2E_ADMIN_PASSWORD=... pnpm e2e   # Suite completa (necesita backend + frontend arriba)

# Tenant nuevo (script local)
pnpm --dir backend tenant:crear -- --code mi-tienda --nombre "Mi Tienda"
```

---

## QA y tests (REGLA INVIOLABLE)

**Antes de dar por terminada cualquier tarea, los tests existentes deben pasar:**

- `pnpm --dir backend test` → Jest debe estar en verde (107+ tests actuales)
- `pnpm e2e` (frontend) → Playwright debe estar en verde (13+ specs actuales)

**Si un cambio rompe un test existente:**
1. **Primero entendé por qué** rompió — puede ser un bug genuino que el test detectó
2. **Arreglá el bug real**, no el test, salvo que el test esté efectivamente desactualizado
3. **Si el comportamiento cambió a propósito**, actualizá el test para reflejar el nuevo contrato — y dejá nota del porqué en el commit

**Al agregar funcionalidad nueva:**
- Backend → escribir tests Jest del service y motor (mock de Prisma siguiendo el patrón de `proveedores.service.spec.ts`)
- Frontend → escribir specs Playwright que recorran el flujo desde la UI usando los helpers de `frontend/e2e/helpers.ts` (`login`, `gotoY`, `fillEstable`)

No reportar una tarea como "completa" sin haber corrido las dos suites y verlas verdes. Si una suite no se puede correr por bloqueo externo (Turbopack panic, server caído, falta de credenciales), declararlo explícitamente — nunca asumir que pasa.

---

## Lo que NO hacer

- No usar Server Actions de Next.js para acceder a DB directo. Toda mutación va al backend NestJS.
- No mezclar lógica de negocio en controllers. Controllers son delgados; lógica en services.
- No introducir Redux/Context API para estado de servidor — usar TanStack Query.
- No instalar nuevas librerías UI sin acordar (shadcn/ui es la base).
- No commitear `.env` ni archivos con secretos.
- No usar `npm install` — el repo es `pnpm`.
- No tocar `package-lock.json` — usar `pnpm-lock.yaml`.
- No hardcodear `tenant_code` o `schema` — siempre vía contexto.

---

## Referencias externas

- **nueva_era** (`C:\Users\Felipe\Documents\GitHub\nueva_era`) — ERP de autopartes en producción. Fuente de verdad de patrones UI/UX, tablas, búsqueda, módulos. Mira sus `.github/instructions/*.md`.
- **ENKI backend** (`C:\Users\Felipe\Documents\GitHub\Enki\backend`) — Portal SaaS. Endpoints `/api/v1/saas/...` documentados en `docs/integracion-enki.md`.
