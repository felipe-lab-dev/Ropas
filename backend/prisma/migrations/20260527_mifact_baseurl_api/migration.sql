-- Migración: mifact_base_url ahora apunta a la RAÍZ del API JSON (/api),
-- no al dominio. El código de MifactService concatena `/invoiceService.svc/<Método>`
-- directamente — sin strip ni regex de detección de layout.
--
-- Demo:  https://demo.mifact.net.pe/api
-- Prod:  https://mifact.net.pe/xmifactapi
--
-- Para pasar a producción, el usuario solo edita la baseUrl en la UI de
-- configuración. Cero deploy de código.

-- 1. Nuevo DEFAULT para tenants futuros
ALTER TABLE "configuracion_facturacion"
  ALTER COLUMN "mifact_base_url" SET DEFAULT 'https://demo.mifact.net.pe/api';

-- 2. Backfill: tenants existentes que tengan la URL vieja del demo
--    (con o sin barra final) se actualizan a la nueva.
--    Las URLs custom (RUC productivo, etc.) NO se tocan.
UPDATE "configuracion_facturacion"
SET "mifact_base_url" = 'https://demo.mifact.net.pe/api'
WHERE TRIM(TRAILING '/' FROM "mifact_base_url") = 'https://demo.mifact.net.pe';
