-- Motor Logístico: clasificación ABC (AA, A, B, C, D) por producto.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clasificacion_abc') THEN
    CREATE TYPE "clasificacion_abc" AS ENUM ('AA', 'A', 'B', 'C', 'D');
  END IF;
END $$;

ALTER TABLE "productos"
  ADD COLUMN IF NOT EXISTS "clasificacion"       "clasificacion_abc",
  ADD COLUMN IF NOT EXISTS "clasificacion_score" DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS "clasificado_en"      TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS productos_clasificacion_idx ON "productos" ("clasificacion");
