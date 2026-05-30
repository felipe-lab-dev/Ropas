-- Migración: vincular Compra y NotaCredito a SesionCaja
-- Aplicar vía: pnpm exec tsx scripts/aplicar-migracion-sesion-caja-compras-nc.ts
-- IDEMPOTENTE (ADD COLUMN IF NOT EXISTS + ADD CONSTRAINT IF NOT EXISTS)

-- 1. Agrega sesion_caja_id a la tabla compras
ALTER TABLE "compras"
  ADD COLUMN IF NOT EXISTS "sesion_caja_id" UUID;

-- FK opcional: compras.sesion_caja_id → sesiones_caja.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'compras'
      AND constraint_name = 'compras_sesion_caja_id_fkey'
  ) THEN
    ALTER TABLE "compras"
      ADD CONSTRAINT "compras_sesion_caja_id_fkey"
      FOREIGN KEY ("sesion_caja_id")
      REFERENCES "sesiones_caja"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Agrega sesion_caja_id a la tabla notas_credito
ALTER TABLE "notas_credito"
  ADD COLUMN IF NOT EXISTS "sesion_caja_id" UUID;

-- FK opcional: notas_credito.sesion_caja_id → sesiones_caja.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'notas_credito'
      AND constraint_name = 'notas_credito_sesion_caja_id_fkey'
  ) THEN
    ALTER TABLE "notas_credito"
      ADD CONSTRAINT "notas_credito_sesion_caja_id_fkey"
      FOREIGN KEY ("sesion_caja_id")
      REFERENCES "sesiones_caja"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Agrega medio_devolucion (enum medio_pago nullable) a la tabla notas_credito
ALTER TABLE "notas_credito"
  ADD COLUMN IF NOT EXISTS "medio_devolucion" medio_pago;
