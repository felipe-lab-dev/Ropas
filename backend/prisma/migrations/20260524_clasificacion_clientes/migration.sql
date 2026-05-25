-- Clasificación ABC (AA, A, B, C, D) por cliente, vía motor RFM
-- (Recency, Frequency, Monetary). Reusa el enum clasificacion_abc creado
-- por la migración 20260521_motor_logistico para productos.
ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "clasificacion"       "clasificacion_abc",
  ADD COLUMN IF NOT EXISTS "clasificacion_score" DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS "clasificado_en"      TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS clientes_clasificacion_idx ON "clientes" ("clasificacion");
