---
applyTo: "**/*.{ts,tsx}"
---

# Reglas globales del proyecto Ropas

1. **Idioma del dominio: español.** Toda entidad, campo, tabla, ruta API y mensaje al usuario en español. Solo términos puramente técnicos en inglés (`request`, `boolean`).
2. **TypeScript estricto.** `strict: true`, `noUncheckedIndexedAccess: true`. Nada de `any`.
3. **Multi-tenancy obligatorio.** Cada operación de DB pasa por `TenantContext`. Cero queries sin tenant.
4. **Soft delete global.** Todos los modelos tienen `eliminadoEn DateTime?`.
5. **Respuesta API estándar** (`{ exito, datos, mensaje }` o paginado).
6. **Errores tipados.** No lanzar strings ni `Error` puro — usar las clases de `core/errors`.
7. **Permisos** formato `modulo:accion`.
8. **Logs Pino estructurados.** Cero `console.log` en código de producción.
9. **Naming**: archivos `kebab-case.ts`, clases `PascalCase`, vars `camelCase`, rutas API `/api/v1/kebab-case`.
10. **Commits en español** describiendo el "por qué" más que el "qué".

## Lo que NO hacer

- No mezclar lógica de negocio en controllers o componentes UI.
- No usar Server Actions de Next.js para acceder a DB — todo va vía API NestJS.
- No instalar libs sin discutir (excepto las del stack base).
- No commitear `.env` ni datos reales.
- No usar `npm`/`yarn` — el repo es `pnpm`.
- No hardcodear tenant codes ni IDs.
