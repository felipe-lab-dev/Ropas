-- Elimina la columna correo_notificacion de configuracion_facturacion.
--
-- Motivo: el campo se exponía en la UI de Configuración → Facturación Electrónica
-- pero ninguna pieza del backend lo leía para disparar nada (no había listener,
-- ni cron, ni endpoint que lo consumiera). MifactService.enviarCorreo() existía
-- pero nadie lo invocaba. Se decidió quitar el campo + el método sin reemplazo.
--
-- Aplicable por schema tenant_* — el aplicador setea search_path antes de
-- ejecutar este SQL.

ALTER TABLE configuracion_facturacion DROP COLUMN IF EXISTS correo_notificacion;
