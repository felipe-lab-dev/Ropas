-- Agrega columna `codigo` (texto libre, único por tenant) a productos.
ALTER TABLE "productos"
  ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema() AND indexname = 'productos_codigo_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX productos_codigo_key ON productos (codigo) WHERE codigo IS NOT NULL';
  END IF;
END $$;
