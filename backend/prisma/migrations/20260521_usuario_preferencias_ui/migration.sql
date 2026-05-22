-- Agrega columna preferencias_ui (JSON) a usuarios para persistir
-- estado de UI por usuario: orden de columnas, anchos, filtros, sort.
ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "preferencias_ui" JSONB NOT NULL DEFAULT '{}';
