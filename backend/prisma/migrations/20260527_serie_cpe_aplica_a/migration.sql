-- Agrega aplica_a a series_cpe y ajusta unicidad.
--
-- aplica_a es el subtipo cuando tipo_cpe es transversal (NC, ND aplican sobre
-- factura o boleta). Para factura/boleta normales, aplica_a queda NULL.
--
-- Unicidad nueva:
--   1. Total: (sucursal_id, tipo_cpe, aplica_a, serie) — reemplaza el unique anterior
--      que era (sucursal_id, tipo_cpe, serie). Necesario porque podemos tener
--      F001 como factura Y F001 como nota_credito(aplica_a=factura) sin colisión.
--   2. Parcial: a lo sumo UNA serie ACTIVA por (sucursal_id, tipo_cpe, aplica_a).
--      Refleja realidad SUNAT: cuando una serie llega al máximo correlativo, se
--      desactiva y se abre la siguiente. Tener dos activas simultáneamente para
--      el mismo subtipo no es válido.
--
-- Migration idempotente: todos los DDL usan IF [NOT] EXISTS, se puede re-aplicar.

-- 1. Columna nueva
ALTER TABLE "series_cpe" ADD COLUMN IF NOT EXISTS "aplica_a" "tipo_cpe";

-- 2. Drop índices viejos (nombres tal como existen en prod hoy).
--    También dropeamos los nombres "canónicos" del snapshot por si algún tenant
--    los tiene con ese nombre — IF EXISTS los hace seguros.
DROP INDEX IF EXISTS "series_cpe_sucursal_tipo_idx";
DROP INDEX IF EXISTS "series_cpe_sucursal_tipo_serie_key";
DROP INDEX IF EXISTS "series_cpe_sucursal_id_tipo_cpe_idx";
DROP INDEX IF EXISTS "series_cpe_sucursal_id_tipo_cpe_serie_key";

-- 3. Índices nuevos: unicidad total + búsqueda por (sucursal, tipo, aplica_a)
CREATE UNIQUE INDEX IF NOT EXISTS "series_cpe_sucursal_id_tipo_cpe_aplica_a_serie_key"
  ON "series_cpe"("sucursal_id", "tipo_cpe", "aplica_a", "serie");

CREATE INDEX IF NOT EXISTS "series_cpe_sucursal_id_tipo_cpe_aplica_a_idx"
  ON "series_cpe"("sucursal_id", "tipo_cpe", "aplica_a");

-- 4. Unicidad parcial sobre series activas. Postgres trata cada NULL como
--    distinto en unique, así que para forzar "solo una activa con aplica_a=NULL
--    por (sucursal,tipo)" hay que usar índices partial separados por NULL/NOT NULL.
--    Evitamos COALESCE(...) porque el cast tipo_cpe::text no es IMMUTABLE y
--    Postgres lo rechaza en expresiones de índice.

-- 4a. Para factura/boleta/guia normales (aplica_a IS NULL):
CREATE UNIQUE INDEX IF NOT EXISTS "series_cpe_unicidad_activa_sin_aplica_a"
  ON "series_cpe" ("sucursal_id", "tipo_cpe")
  WHERE "activa" = true AND "aplica_a" IS NULL;

-- 4b. Para NC/ND con subtipo (aplica_a IS NOT NULL):
CREATE UNIQUE INDEX IF NOT EXISTS "series_cpe_unicidad_activa_con_aplica_a"
  ON "series_cpe" ("sucursal_id", "tipo_cpe", "aplica_a")
  WHERE "activa" = true AND "aplica_a" IS NOT NULL;
