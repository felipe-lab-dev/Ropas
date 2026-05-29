-- Introduce el discriminador `es_nota_de_venta` en `ventas`.
--
-- Decisión Felipe (2026-05-29): permitir ventas internas que NO se envían a
-- SUNAT, como tercera modalidad además de boleta/factura. El discriminador
-- es explícito (boolean) en lugar de heurístico (tipo_cpe IS NULL), para
-- distinguir limpiamente de la situación legacy "tenant sin facturación
-- electrónica configurada".
--
-- Reglas garantizadas por la DB (check constraint):
--   - Si es_nota_de_venta = true, tipo_cpe DEBE ser NULL.
--   - Ventas existentes nacen con es_nota_de_venta = false (default), por
--     lo tanto la migración es retrocompatible 1-a-1 con el estado actual.
--
-- Resolución del bug del estado 'pendiente' en NC (notas-credito.service.ts)
-- se hace solo en código — no requiere DDL.

ALTER TABLE "ventas"
  ADD COLUMN IF NOT EXISTS "es_nota_de_venta" BOOLEAN NOT NULL DEFAULT false;

-- Idempotente: solo crea el check si no existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ventas_modalidad_excluyente_chk'
      AND conrelid = (SELECT oid FROM pg_class WHERE relname = 'ventas' AND relnamespace = current_schema()::regnamespace)
  ) THEN
    ALTER TABLE "ventas"
      ADD CONSTRAINT "ventas_modalidad_excluyente_chk"
      CHECK (NOT ("es_nota_de_venta" = true AND "tipo_cpe" IS NOT NULL));
  END IF;
END $$;
