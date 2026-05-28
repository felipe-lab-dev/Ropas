-- Endurece la unicidad de series_cpe: ahora hay UNA sola fila por
-- (sucursal_id, tipo_cpe, aplica_a), sin importar el campo `activa`.
--
-- Antes: dos índices parciales WHERE activa=true permitían inactivas duplicadas.
-- Ahora: el toggle activa/inactiva es para "pausar" la serie, no para coexistir
--        con otras del mismo tipo. UNA fila total, sin importar el estado.
--
-- Razón: simplificación pedida por el usuario (2026-05-28). La pantalla mostraba
-- B002 inactiva + B078 activa como ruido visual confuso. B002 con correlativo=0
-- fue limpiada manualmente antes de aplicar este constraint.
--
-- Postgres trata cada NULL como distinto en UNIQUE normal, así que para que
-- aplica_a=NULL (factura, boleta, guias) sea único por (sucursal, tipo)
-- también, mantenemos dos índices parciales — pero AHORA sin la condición
-- de activa.

-- Drop índices viejos (parciales por activa)
DROP INDEX IF EXISTS "series_cpe_unicidad_activa_sin_aplica_a";
DROP INDEX IF EXISTS "series_cpe_unicidad_activa_con_aplica_a";

-- Drop el unique compuesto con `serie` también — ya no es necesario:
-- si solo hay UNA fila por (sucursal, tipo, aplica_a), la unicidad de la
-- combinación (sucursal, tipo, aplica_a, serie) cae como subset.
DROP INDEX IF EXISTS "series_cpe_sucursal_id_tipo_cpe_aplica_a_serie_key";

-- Nuevos índices: unicidad TOTAL por (sucursal, tipo, aplica_a)
CREATE UNIQUE INDEX IF NOT EXISTS "series_cpe_unicidad_sin_aplica_a"
  ON "series_cpe" ("sucursal_id", "tipo_cpe")
  WHERE "aplica_a" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "series_cpe_unicidad_con_aplica_a"
  ON "series_cpe" ("sucursal_id", "tipo_cpe", "aplica_a")
  WHERE "aplica_a" IS NOT NULL;
