-- Elimina el campo `emitir_al_confirmar` de configuracion_facturacion.
--
-- Decisión Felipe (2026-05-29): el flag generaba confusión con la nueva
-- estrategia de "nota de venta" interna. Antes había dos ejes superpuestos:
--   (a) qué tipo de comprobante emite la venta (boleta/factura/nota de venta)
--   (b) si la emisión a SUNAT corre auto o manual al confirmar
-- Con la introducción de "nota de venta", el eje (b) deja de tener sentido:
-- si NO querés enviar a SUNAT, elegís nota de venta. Si elegís boleta o
-- factura, siempre se emite al confirmar.
--
-- Comportamiento post-migración:
--   - Toda venta con tipo_cpe NOT NULL auto-emite al confirmar (via listener).
--   - Si Mifact está down o el tenant no tiene credenciales, el listener
--     ya captura el error silencioso y el documento queda en 'pendiente'
--     para reintento manual o vía cron.
--
-- Riesgo: destructivo (DROP COLUMN). Aplicar tras desplegar el código que
-- ya no lee/escribe la columna.

ALTER TABLE "configuracion_facturacion" DROP COLUMN IF EXISTS "emitir_al_confirmar";
