-- Notas de Crédito (devoluciones parciales/totales) y soft-delete de Venta
--
-- Cambios:
--   1. ventas: agrega columna eliminado_en (soft delete consistente con la regla global)
--   2. enum estado_nota_credito ('emitida','anulada')
--   3. tabla notas_credito (cabecera, una por devolución)
--   4. tabla notas_credito_items (detalle: variante, cantidad, monto)
--
-- La nota de crédito:
--   - es siempre contra una venta NO anulada
--   - cada item devuelve cantidad>0 al stock con tipo `ingreso_devolucion`
--   - el total se decrementa de cliente.totalCompras
--   - es idempotente: no se puede devolver más cantidad que la vendida
--     menos lo ya devuelto en NC previas

ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "ventas_eliminado_idx" ON "ventas"("eliminado_en");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'estado_nota_credito' AND n.nspname = current_schema()) THEN
    CREATE TYPE "estado_nota_credito" AS ENUM ('emitida', 'anulada');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "notas_credito" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "numero"            VARCHAR(20) UNIQUE NOT NULL,
  "venta_id"          UUID NOT NULL REFERENCES "ventas"("id"),
  "sucursal_id"       UUID NOT NULL REFERENCES "sucursales"("id"),
  "cliente_id"        UUID REFERENCES "clientes"("id"),
  "emitida_por_id"    UUID NOT NULL REFERENCES "usuarios"("id"),
  "estado"            "estado_nota_credito" NOT NULL DEFAULT 'emitida',
  "motivo"            TEXT NOT NULL,
  "subtotal"          DECIMAL(12,2) NOT NULL,
  "total"             DECIMAL(12,2) NOT NULL,
  "restituye_stock"   BOOLEAN NOT NULL DEFAULT true,
  "anulada_en"        TIMESTAMP,
  "motivo_anulacion"  TEXT,
  "creado_en"         TIMESTAMP NOT NULL DEFAULT now(),
  "actualizado_en"    TIMESTAMP NOT NULL DEFAULT now(),
  "eliminado_en"      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "notas_credito_venta_idx" ON "notas_credito"("venta_id");
CREATE INDEX IF NOT EXISTS "notas_credito_cliente_idx" ON "notas_credito"("cliente_id");
CREATE INDEX IF NOT EXISTS "notas_credito_eliminado_idx" ON "notas_credito"("eliminado_en");

CREATE TABLE IF NOT EXISTS "notas_credito_items" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nota_credito_id"   UUID NOT NULL REFERENCES "notas_credito"("id") ON DELETE CASCADE,
  "venta_item_id"     UUID NOT NULL REFERENCES "venta_items"("id"),
  "variante_id"       UUID NOT NULL REFERENCES "variantes"("id"),
  "descripcion"       VARCHAR(240) NOT NULL,
  "cantidad"          INTEGER NOT NULL CHECK ("cantidad" > 0),
  "precio_unitario"   DECIMAL(12,2) NOT NULL,
  "subtotal"          DECIMAL(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS "notas_credito_items_nc_idx" ON "notas_credito_items"("nota_credito_id");
CREATE INDEX IF NOT EXISTS "notas_credito_items_vi_idx" ON "notas_credito_items"("venta_item_id");
