-- Cupones y Promociones — módulo de marketing
-- Crea: enums tipo_descuento_cupon, estado_cupon, segmento_cupon, aplicable_a_cupon
--       tablas cupones, cupones_usos
--       columnas en ventas: cupon_id, cupon_codigo, descuento_cupon

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'tipo_descuento_cupon' AND n.nspname = current_schema()) THEN
    CREATE TYPE "tipo_descuento_cupon" AS ENUM ('porcentaje', 'monto_fijo');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'estado_cupon' AND n.nspname = current_schema()) THEN
    CREATE TYPE "estado_cupon" AS ENUM ('activo', 'pausado', 'expirado', 'agotado');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'segmento_cupon' AND n.nspname = current_schema()) THEN
    CREATE TYPE "segmento_cupon" AS ENUM (
      'todos', 'vip_aa', 'vip_a', 'vip_b', 'vip_c',
      'lista_clientes', 'nuevos_clientes', 'reactivacion'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'aplicable_a_cupon' AND n.nspname = current_schema()) THEN
    CREATE TYPE "aplicable_a_cupon" AS ENUM ('toda_compra', 'categorias', 'productos');
  END IF;
END $$;

-- Tabla cupones
CREATE TABLE IF NOT EXISTS "cupones" (
  "id"                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo"                     VARCHAR(40) NOT NULL UNIQUE,
  "nombre"                     VARCHAR(160) NOT NULL,
  "descripcion"                TEXT,
  "tipo_descuento"             "tipo_descuento_cupon" NOT NULL,
  "valor_descuento"            DECIMAL(12, 2) NOT NULL,
  "monto_minimo_compra"        DECIMAL(12, 2),
  "descuento_maximo"           DECIMAL(12, 2),
  "fecha_inicio"               TIMESTAMP(3) NOT NULL,
  "fecha_fin"                  TIMESTAMP(3) NOT NULL,
  "usos_maximos_total"         INTEGER,
  "usos_maximos_por_cliente"   INTEGER NOT NULL DEFAULT 1,
  "segmento"                   "segmento_cupon" NOT NULL DEFAULT 'todos',
  "clientes_elegibles_ids"     UUID[] NOT NULL DEFAULT '{}',
  "aplicable_a"                "aplicable_a_cupon" NOT NULL DEFAULT 'toda_compra',
  "categorias_aplicables_ids"  UUID[] NOT NULL DEFAULT '{}',
  "productos_aplicables_ids"   UUID[] NOT NULL DEFAULT '{}',
  "campania"                   VARCHAR(120),
  "plantilla"                  VARCHAR(60),
  "estado"                     "estado_cupon" NOT NULL DEFAULT 'activo',
  "pausado_en"                 TIMESTAMP(3),
  "diseno_color_primario"      VARCHAR(9) NOT NULL DEFAULT '#7c3aed',
  "diseno_color_secundario"    VARCHAR(9) NOT NULL DEFAULT '#1e1b4b',
  "diseno_mensaje"             VARCHAR(240),
  "diseno_emoji"               VARCHAR(8),
  "creado_por_id"              UUID REFERENCES "usuarios"("id"),
  "creado_en"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eliminado_en"               TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS cupones_codigo_idx ON "cupones" ("codigo");
CREATE INDEX IF NOT EXISTS cupones_estado_fechafin_idx ON "cupones" ("estado", "fecha_fin");
CREATE INDEX IF NOT EXISTS cupones_eliminado_idx ON "cupones" ("eliminado_en");

-- Tabla cupones_usos
CREATE TABLE IF NOT EXISTS "cupones_usos" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cupon_id"         UUID NOT NULL REFERENCES "cupones"("id") ON DELETE CASCADE,
  "cliente_id"       UUID REFERENCES "clientes"("id"),
  "venta_id"         UUID NOT NULL UNIQUE REFERENCES "ventas"("id") ON DELETE CASCADE,
  "monto_descuento"  DECIMAL(12, 2) NOT NULL,
  "monto_venta"      DECIMAL(12, 2) NOT NULL,
  "aplicado_en"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS cupones_usos_cupon_idx ON "cupones_usos" ("cupon_id", "aplicado_en");
CREATE INDEX IF NOT EXISTS cupones_usos_cliente_idx ON "cupones_usos" ("cliente_id");

-- Columnas en ventas
ALTER TABLE "ventas"
  ADD COLUMN IF NOT EXISTS "descuento_cupon" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cupon_id"        UUID REFERENCES "cupones"("id"),
  ADD COLUMN IF NOT EXISTS "cupon_codigo"    VARCHAR(40);

CREATE INDEX IF NOT EXISTS ventas_cupon_idx ON "ventas" ("cupon_id");
