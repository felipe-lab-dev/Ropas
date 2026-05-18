-- Extiende movimientos_caja con medio, comprobante, contraparte, creadoPorId, eliminadoEn
ALTER TABLE "movimientos_caja"
  ADD COLUMN IF NOT EXISTS "medio"          "medio_pago" NOT NULL DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS "comprobante"    VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "contraparte"    VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "creado_por_id"  UUID,
  ADD COLUMN IF NOT EXISTS "eliminado_en"   TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_caja_creado_por_id_fkey'
  ) THEN
    ALTER TABLE "movimientos_caja"
      ADD CONSTRAINT "movimientos_caja_creado_por_id_fkey"
      FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "movimientos_caja_sesion_id_idx";
CREATE INDEX IF NOT EXISTS "movimientos_caja_sesion_id_creado_en_idx"
  ON "movimientos_caja" ("sesion_id", "creado_en");
CREATE INDEX IF NOT EXISTS "movimientos_caja_sesion_id_tipo_idx"
  ON "movimientos_caja" ("sesion_id", "tipo");
