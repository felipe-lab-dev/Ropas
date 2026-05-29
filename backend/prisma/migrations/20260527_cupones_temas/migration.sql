-- Cupones: agregar campos para temas estacionales y fondo personalizado.
-- - tema_estacional: ID del catálogo TEMAS_ESTACIONALES (ej. 'inti-raymi', 'navidad').
-- - fondo_imagen_url: URL pública (Azure Blob) de imagen de fondo subida por el usuario.

ALTER TABLE "cupones"
  ADD COLUMN IF NOT EXISTS "tema_estacional"  VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "fondo_imagen_url" VARCHAR(500);
