-- Elimina los flags de comportamiento de envío/retorno de configuracion_facturacion:
--   enviar_automatico_a_sunat, retornar_pdf, retornar_xml_envio, retornar_xml_cdr
--
-- Decisión Felipe (2026-05-29):
--   1) El envío a SUNAT es SIEMPRE síncrono — el cajero necesita saber al instante
--      si SUNAT aceptó o rechazó. No tiene sentido un toggle para encolar.
--   2) El PDF, XML y CDR se solicitan ON-DEMAND (cuando el usuario presiona el
--      botón respectivo en el detalle de la venta vía GetInvoice), no en la
--      emisión. Por eso pedirlos en la emisión era inútil: la respuesta se
--      descartaba (dataExitosa() nunca persistía esos bytes). Toggles fantasma.
--
-- Se conserva `formato_impresion`: es la preferencia de formato del PDF del
-- tenant (A4 / A5 / Ticket 80mm) que usará el flujo on-demand.
--
-- Comportamiento post-migración (ya en el código desplegado):
--   - cpe-builder usa sus defaults: enviarASunat=true, retornar*=false.
--   - opcionesMifact() solo pasa formato_impresion.
--
-- Riesgo: destructivo (DROP COLUMN). APLICAR SOLO DESPUÉS de desplegar el código
-- que ya no lee/escribe estas columnas. Si se aplica antes, el backend vivo
-- (cliente Prisma viejo) hace SELECT de las columnas y rompe toda lectura de
-- config y toda emisión de CPE.

ALTER TABLE "configuracion_facturacion" DROP COLUMN IF EXISTS "enviar_automatico_a_sunat";
ALTER TABLE "configuracion_facturacion" DROP COLUMN IF EXISTS "retornar_pdf";
ALTER TABLE "configuracion_facturacion" DROP COLUMN IF EXISTS "retornar_xml_envio";
ALTER TABLE "configuracion_facturacion" DROP COLUMN IF EXISTS "retornar_xml_cdr";
