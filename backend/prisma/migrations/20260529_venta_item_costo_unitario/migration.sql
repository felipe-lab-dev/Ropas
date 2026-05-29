-- Agrega costo congelado por línea a venta_items (snapshot de rentabilidad).
-- Idempotente y aditiva: ADD COLUMN IF NOT EXISTS, nullable.
ALTER TABLE "venta_items" ADD COLUMN IF NOT EXISTS "costo_unitario" DECIMAL(14, 4);

-- Backfill histórico: rellena el costo desde el precio_compra actual del catálogo
-- para las ventas previas. Los productos sin precio_compra quedan en NULL ("sin datos").
UPDATE "venta_items" vi
   SET "costo_unitario" = p."precio_compra"
  FROM "variantes" v
  JOIN "productos" p ON p."id" = v."producto_id"
 WHERE vi."variante_id" = v."id"
   AND vi."costo_unitario" IS NULL
   AND p."precio_compra" IS NOT NULL;
