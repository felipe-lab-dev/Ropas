-- Elimina el campo `activa` de series_cpe.
--
-- Decisión Felipe (2026-05-28): activar/desactivar series introducía confusión
-- de UX y deuda técnica. Una serie creada es inmutable; no se desactiva ni se
-- borra (regla fiscal). Si necesitara migrar a otra serie por correlativo
-- agotado, se armaría una operación dedicada en su momento.
--
-- Riesgo: destructivo, pero solo afecta el flag de pausado; los datos fiscales
-- (serie, correlativo_actual, tipo_cpe, aplica_a) se preservan intactos.

ALTER TABLE "series_cpe" DROP COLUMN IF EXISTS "activa";
