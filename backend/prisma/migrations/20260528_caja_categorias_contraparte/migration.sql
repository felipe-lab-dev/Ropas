-- Extiende movimientos_caja con categoría tipada + contraparte vinculable a entidad existente.
-- Patrón idempotente para no romper si parte se aplicó manualmente.

-- 1. Enum CategoriaMovimientoCaja
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoria_movimiento_caja') THEN
    CREATE TYPE "categoria_movimiento_caja" AS ENUM (
      'saldo_anterior',
      'adelanto_cliente',
      'cobro_credito',
      'devolucion_proveedor',
      'otro_ingreso',
      'pago_proveedor',
      'servicio_basico',
      'comision_empleado',
      'refrigerio',
      'movilidad',
      'publicidad',
      'devolucion_cliente',
      'otro_egreso'
    );
  END IF;
END $$;

-- 2. Enum TipoContraparte
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_contraparte') THEN
    CREATE TYPE "tipo_contraparte" AS ENUM (
      'cliente',
      'proveedor',
      'empleado',
      'otro'
    );
  END IF;
END $$;

-- 3. Columnas nuevas en movimientos_caja
ALTER TABLE "movimientos_caja"
  ADD COLUMN IF NOT EXISTS "categoria"             "categoria_movimiento_caja" DEFAULT 'otro_ingreso',
  ADD COLUMN IF NOT EXISTS "sub_categoria"         VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "contraparte_tipo"      "tipo_contraparte",
  ADD COLUMN IF NOT EXISTS "contraparte_id"        UUID,
  ADD COLUMN IF NOT EXISTS "contraparte_documento" VARCHAR(20);

-- 4. Backfill: los movimientos previos quedan en 'otro_ingreso' / 'otro_egreso' según tipo.
UPDATE "movimientos_caja"
   SET "categoria" = CASE
         WHEN "tipo" = 'ingreso' THEN 'otro_ingreso'::"categoria_movimiento_caja"
         ELSE 'otro_egreso'::"categoria_movimiento_caja"
       END
 WHERE "categoria" IS NULL;

-- 5. Índice por categoría para futuros desgloses
CREATE INDEX IF NOT EXISTS "movimientos_caja_sesion_id_categoria_idx"
  ON "movimientos_caja" ("sesion_id", "categoria");
