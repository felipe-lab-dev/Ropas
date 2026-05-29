-- 20260529_tenant_branding
-- Branding por tienda (logo SVG + nombre + eslogan) servido al login (pre-auth)
-- y al shell autenticado. Vive en public.tenants para que el endpoint publico
-- GET /api/v1/branding/:codigo lo lea SIN resolver el schema del tenant.
--
-- Como la DB es compartida dev/prod (pg-ropas -> ropas_prod), editar el branding
-- en localhost se refleja en produccion (loremstore.tienda.enkihubs.com) al instante.
--
-- Forma del JSON: { "logoSvg": string|null, "nombre": string|null, "subtitulo": string|null }
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. Seguro de reaplicar. No destructivo.
-- Aplica UNA sola vez al schema public (no es per-tenant).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS branding JSONB;

-- Rollback (manual, DB compartida sin tracking de prisma migrate):
--   ALTER TABLE public.tenants DROP COLUMN IF EXISTS branding;
