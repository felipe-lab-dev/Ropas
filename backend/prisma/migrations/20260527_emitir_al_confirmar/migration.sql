-- Agrega ConfiguracionFacturacion.emitirAlConfirmar (boolean, default true)
ALTER TABLE "configuracion_facturacion"
  ADD COLUMN IF NOT EXISTS "emitir_al_confirmar" BOOLEAN NOT NULL DEFAULT true;
