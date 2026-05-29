-- 20260530_logs_sistema
-- Modulo "Logs de Sistema": tabla cross-tenant que captura errores 5xx (y 409/413/422)
-- via AppExceptionFilter. Vive en schema `public` para tambien atrapar errores de
-- requests sin tenant resuelto.
--
-- Idempotente: usa IF NOT EXISTS / DO blocks. Seguro de reaplicar.

-- Enum de severidad.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severidad_error_sistema') THEN
    CREATE TYPE severidad_error_sistema AS ENUM ('warn', 'error', 'critical');
  END IF;
END$$;

-- Tabla principal.
CREATE TABLE IF NOT EXISTS public.errores_sistema (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_codigo    VARCHAR(64),
  mensaje          VARCHAR(2000) NOT NULL,
  tipo             VARCHAR(120),
  stack            TEXT,
  ruta             VARCHAR(500),
  metodo           VARCHAR(10),
  status_code      INTEGER,
  usuario_id       UUID,
  usuario_nombre   VARCHAR(200),
  sucursal_id      UUID,
  ip               VARCHAR(45),
  user_agent       VARCHAR(500),
  request_body     JSONB,
  request_query    JSONB,
  replica          VARCHAR(120),
  severidad        severidad_error_sistema NOT NULL DEFAULT 'error',
  resuelto         BOOLEAN NOT NULL DEFAULT FALSE,
  resuelto_en      TIMESTAMPTZ,
  resuelto_por     UUID,
  notas_resolucion TEXT,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para listado/filtrado.
CREATE INDEX IF NOT EXISTS errores_sistema_creado_en_idx
  ON public.errores_sistema (creado_en DESC);

CREATE INDEX IF NOT EXISTS errores_sistema_tenant_creado_idx
  ON public.errores_sistema (tenant_codigo, creado_en DESC);

CREATE INDEX IF NOT EXISTS errores_sistema_resuelto_creado_idx
  ON public.errores_sistema (resuelto, creado_en DESC);
