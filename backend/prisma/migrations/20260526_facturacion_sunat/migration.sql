-- Facturación Electrónica SUNAT — Mifact OSE
-- Agrega: enums tipo_cpe, tipo_afectacion_igv, tipo_nota_credito, estado_sunat
--         tablas series_cpe, documentos_electronicos, configuracion_facturacion
--         columnas SUNAT en clientes, sucursales, productos, ventas, notas_credito
--         migración destructiva de tipo_documento (quita cpf/cnpj, agrega carne_extranjeria)
--
-- IMPORTANTE: aplica SOLO a schemas tenant_* (via search_path).
-- Ejecutar con: pnpm exec tsx scripts/aplicar-migracion-facturacion.ts

-- ======================================================================
-- SECCIÓN 1 — MIGRACIÓN DE tipo_documento
-- (quita cpf, cnpj; agrega carne_extranjeria; cambia default a 'dni')
-- ======================================================================

-- 1a. Proteger datos existentes: cualquier cliente/proveedor con cpf o cnpj
--     pasa a 'otro' antes de tocar el enum.
UPDATE "clientes"
  SET tipo_documento = 'otro'
  WHERE tipo_documento IN ('cpf', 'cnpj');

-- 1a (proveedores): solo si la tabla existe (tenants viejos sin motor_logistico)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema()
             AND table_name = 'proveedores') THEN
    UPDATE "proveedores"
      SET tipo_documento = 'otro'
      WHERE tipo_documento IN ('cpf', 'cnpj');
  END IF;
END $$;

-- 1b. Crear enum temporal con los nuevos valores
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = '_tipo_documento_nuevo' AND n.nspname = current_schema()) THEN
    CREATE TYPE "_tipo_documento_nuevo" AS ENUM (
      'dni',
      'carne_extranjeria',
      'ruc',
      'pasaporte',
      'otro'
    );
  END IF;
END $$;

-- 1c. Migrar columna clientes.tipo_documento al tipo temporal
ALTER TABLE "clientes"
  ALTER COLUMN "tipo_documento" DROP DEFAULT;

ALTER TABLE "clientes"
  ALTER COLUMN "tipo_documento" TYPE "_tipo_documento_nuevo"
  USING (
    CASE tipo_documento::text
      WHEN 'dni'      THEN 'dni'::_tipo_documento_nuevo
      WHEN 'ruc'      THEN 'ruc'::_tipo_documento_nuevo
      WHEN 'pasaporte'THEN 'pasaporte'::_tipo_documento_nuevo
      ELSE                 'otro'::_tipo_documento_nuevo
    END
  );

-- 1d. Migrar columna proveedores.tipo_documento al tipo temporal (solo si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema()
             AND table_name = 'proveedores') THEN
    ALTER TABLE "proveedores"
      ALTER COLUMN "tipo_documento" DROP DEFAULT;

    ALTER TABLE "proveedores"
      ALTER COLUMN "tipo_documento" TYPE "_tipo_documento_nuevo"
      USING (
        CASE tipo_documento::text
          WHEN 'dni'      THEN 'dni'::_tipo_documento_nuevo
          WHEN 'ruc'      THEN 'ruc'::_tipo_documento_nuevo
          WHEN 'pasaporte'THEN 'pasaporte'::_tipo_documento_nuevo
          ELSE                 'otro'::_tipo_documento_nuevo
        END
      );
  END IF;
END $$;

-- 1e. Eliminar el enum viejo
DROP TYPE IF EXISTS "tipo_documento";

-- 1f. Renombrar el temporal al nombre canónico
ALTER TYPE "_tipo_documento_nuevo" RENAME TO "tipo_documento";

-- 1g. Restaurar defaults con el tipo correcto
ALTER TABLE "clientes"
  ALTER COLUMN "tipo_documento" SET DEFAULT 'dni'::tipo_documento;

-- 1g (proveedores): solo si la tabla existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema()
             AND table_name = 'proveedores') THEN
    ALTER TABLE "proveedores"
      ALTER COLUMN "tipo_documento" SET DEFAULT 'ruc'::tipo_documento;
  END IF;
END $$;

-- ======================================================================
-- SECCIÓN 2 — NUEVOS ENUMS
-- ======================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'tipo_cpe' AND n.nspname = current_schema()) THEN
    CREATE TYPE "tipo_cpe" AS ENUM (
      'factura',
      'boleta',
      'nota_credito',
      'nota_debito',
      'guia_remitente',
      'guia_transportista'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'tipo_afectacion_igv' AND n.nspname = current_schema()) THEN
    CREATE TYPE "tipo_afectacion_igv" AS ENUM (
      'gravado_onerosa',
      'gravado_retiro_premio',
      'gravado_retiro_donacion',
      'gravado_retiro',
      'gravado_retiro_publicidad',
      'gravado_bonificaciones',
      'gravado_retiro_trabajadores',
      'gravado_ivap',
      'exonerado_onerosa',
      'exonerado_transferencia_gratuita',
      'inafecto_onerosa',
      'inafecto_retiro_bonificacion',
      'inafecto_retiro',
      'inafecto_retiro_muestras',
      'inafecto_retiro_convenio',
      'inafecto_retiro_premio',
      'inafecto_retiro_publicidad',
      'inafecto_transf_gratuita_no_grav',
      'exportacion'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'tipo_nota_credito' AND n.nspname = current_schema()) THEN
    CREATE TYPE "tipo_nota_credito" AS ENUM (
      'anulacion_operacion',
      'anulacion_error_ruc',
      'correccion_descripcion',
      'descuento_global',
      'descuento_item',
      'devolucion_total',
      'devolucion_item',
      'bonificacion',
      'disminucion_valor',
      'otros_conceptos',
      'ajustes_exportacion',
      'ajustes_montos_fechas_pago',
      'ajustes_intereses_penalidades'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'estado_sunat' AND n.nspname = current_schema()) THEN
    CREATE TYPE "estado_sunat" AS ENUM (
      'pendiente',
      'en_proceso',
      'aceptado',
      'aceptado_observado',
      'rechazado',
      'anulado',
      'baja_pendiente'
    );
  END IF;
END $$;

-- ======================================================================
-- SECCIÓN 3 — NUEVA TABLA: series_cpe
-- ======================================================================

CREATE TABLE IF NOT EXISTS "series_cpe" (
  "id"                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "sucursal_id"       UUID        NOT NULL REFERENCES "sucursales"("id"),
  "tipo_cpe"          "tipo_cpe"  NOT NULL,
  "serie"             VARCHAR(4)  NOT NULL,
  "correlativo_actual" INTEGER    NOT NULL DEFAULT 0,
  "activa"            BOOLEAN     NOT NULL DEFAULT true,
  "creado_en"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS series_cpe_sucursal_tipo_serie_key
  ON "series_cpe" ("sucursal_id", "tipo_cpe", "serie");

CREATE INDEX IF NOT EXISTS series_cpe_sucursal_tipo_idx
  ON "series_cpe" ("sucursal_id", "tipo_cpe");

-- ======================================================================
-- SECCIÓN 4 — NUEVA TABLA: documentos_electronicos
-- (nota_credito_id sin REFERENCES inline — FK se agrega al final condicionalmente)
-- ======================================================================

CREATE TABLE IF NOT EXISTS "documentos_electronicos" (
  "id"                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "venta_id"             UUID            UNIQUE REFERENCES "ventas"("id"),
  "nota_credito_id"      UUID            UNIQUE,
  "tipo_cpe"             "tipo_cpe"      NOT NULL,
  "serie"                VARCHAR(4)      NOT NULL,
  "correlativo"          VARCHAR(8)      NOT NULL,
  "estado_sunat"         "estado_sunat"  NOT NULL DEFAULT 'pendiente',
  "codigo_hash"          VARCHAR(200),
  "cadena_qr"            TEXT,
  "mensaje_sunat"        TEXT,
  "xml_enviado_url"      VARCHAR(500),
  "cdr_url"              VARCHAR(500),
  "pdf_url"              VARCHAR(500),
  "num_intentos"         INTEGER         NOT NULL DEFAULT 0,
  "ultimo_error_texto"   TEXT,
  "enviado_en"           TIMESTAMP(3),
  "aceptado_en"          TIMESTAMP(3),
  "creado_en"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS documentos_electronicos_tipo_serie_correlativo_key
  ON "documentos_electronicos" ("tipo_cpe", "serie", "correlativo");

CREATE INDEX IF NOT EXISTS documentos_electronicos_estado_sunat_idx
  ON "documentos_electronicos" ("estado_sunat");

-- ======================================================================
-- SECCIÓN 5 — NUEVA TABLA: configuracion_facturacion
-- ======================================================================

CREATE TABLE IF NOT EXISTS "configuracion_facturacion" (
  "id"                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "mifact_token_cifrado"       TEXT        NOT NULL,
  "mifact_base_url"            VARCHAR(200) NOT NULL DEFAULT 'https://demo.mifact.net.pe',
  "ruc"                        VARCHAR(11) NOT NULL,
  "razon_social"               VARCHAR(200) NOT NULL,
  "nombre_comercial"           VARCHAR(200),
  "direccion_fiscal"           VARCHAR(240) NOT NULL,
  "ubigeo_fiscal_codigo"       VARCHAR(6)  NOT NULL,
  "enviar_automatico_a_sunat"  BOOLEAN     NOT NULL DEFAULT true,
  "retornar_pdf"               BOOLEAN     NOT NULL DEFAULT true,
  "retornar_xml_envio"         BOOLEAN     NOT NULL DEFAULT false,
  "retornar_xml_cdr"           BOOLEAN     NOT NULL DEFAULT false,
  "formato_impresion"          VARCHAR(3)  NOT NULL DEFAULT '001',
  "correo_notificacion"        VARCHAR(160),
  "creado_en"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================================
-- SECCIÓN 6 — ALTER TABLE clientes
-- ======================================================================

ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "ubigeo_codigo" VARCHAR(6) NULL;

-- ======================================================================
-- SECCIÓN 7 — ALTER TABLE sucursales
-- ======================================================================

ALTER TABLE "sucursales"
  ADD COLUMN IF NOT EXISTS "codigo_anexo_sunat" VARCHAR(4)   NOT NULL DEFAULT '0000',
  ADD COLUMN IF NOT EXISTS "direccion_fiscal"   VARCHAR(240) NULL,
  ADD COLUMN IF NOT EXISTS "ubigeo_codigo"      VARCHAR(6)   NULL;

-- ======================================================================
-- SECCIÓN 8 — ALTER TABLE productos
-- ======================================================================

ALTER TABLE "productos"
  ADD COLUMN IF NOT EXISTS "unidad_medida_codigo"  VARCHAR(10)          NULL DEFAULT 'NIU',
  ADD COLUMN IF NOT EXISTS "tipo_afectacion_igv"   "tipo_afectacion_igv" NOT NULL DEFAULT 'gravado_onerosa';

-- ======================================================================
-- SECCIÓN 9 — ALTER TABLE ventas
-- ======================================================================

ALTER TABLE "ventas"
  ADD COLUMN IF NOT EXISTS "tipo_cpe"                    "tipo_cpe"  NULL,
  ADD COLUMN IF NOT EXISTS "serie_cpe_id"                UUID        NULL REFERENCES "series_cpe"("id"),
  ADD COLUMN IF NOT EXISTS "correlativo"                 VARCHAR(8)  NULL,
  ADD COLUMN IF NOT EXISTS "moneda"                      VARCHAR(3)  NOT NULL DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS "tipo_cambio"                 DECIMAL(10,4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "fecha_vencimiento"           DATE        NULL,
  ADD COLUMN IF NOT EXISTS "codigo_tipo_operacion_sunat" VARCHAR(4)  NOT NULL DEFAULT '0101';

-- Índice para el unique @@unique([tipoCpe, serieCpeId, correlativo]) definido en Prisma
-- Solo crear si no existe ya (puede fallar en rerun si partial nulls no lo soporta bien)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'ventas'
      AND indexname = 'ventas_tipo_cpe_serie_cpe_id_correlativo_key'
  ) THEN
    CREATE UNIQUE INDEX "ventas_tipo_cpe_serie_cpe_id_correlativo_key"
      ON "ventas" ("tipo_cpe", "serie_cpe_id", "correlativo")
      WHERE "tipo_cpe" IS NOT NULL AND "serie_cpe_id" IS NOT NULL AND "correlativo" IS NOT NULL;
  END IF;
END $$;

-- ======================================================================
-- SECCIÓN 10 — ALTER TABLE notas_credito (solo si existe)
-- ======================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema()
             AND table_name = 'notas_credito') THEN
    -- NOTA: schema.prisma define tipoCpeOriginal como TipoCpe? (nullable).
    -- Los campos de serie/correlativo del CPE original también son nullable en prod.
    -- No hay NOT NULL sin default en notas existentes — ver comentario al pie.
    ALTER TABLE "notas_credito"
      ADD COLUMN IF NOT EXISTS "codigo_tipo_nc"          "tipo_nota_credito" NOT NULL DEFAULT 'devolucion_total',
      ADD COLUMN IF NOT EXISTS "tipo_cpe_original"       "tipo_cpe"          NULL,
      ADD COLUMN IF NOT EXISTS "serie_cpe_original"      VARCHAR(4)          NULL,
      ADD COLUMN IF NOT EXISTS "correlativo_cpe_original" VARCHAR(8)         NULL,
      ADD COLUMN IF NOT EXISTS "tipo_cpe"                "tipo_cpe"          NULL,
      ADD COLUMN IF NOT EXISTS "serie_cpe_id"            UUID                NULL REFERENCES "series_cpe"("id"),
      ADD COLUMN IF NOT EXISTS "correlativo"             VARCHAR(8)          NULL;
  END IF;
END $$;

-- ======================================================================
-- FK documentos_electronicos → notas_credito (condicional)
-- Se agrega al final para no bloquear tenants sin notas_credito
-- ======================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema()
             AND table_name = 'notas_credito')
  AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                  WHERE table_schema = current_schema()
                  AND table_name = 'documentos_electronicos'
                  AND constraint_name = 'documentos_electronicos_nota_credito_id_fkey') THEN
    ALTER TABLE "documentos_electronicos"
      ADD CONSTRAINT "documentos_electronicos_nota_credito_id_fkey"
      FOREIGN KEY ("nota_credito_id") REFERENCES "notas_credito"("id");
  END IF;
END $$;
