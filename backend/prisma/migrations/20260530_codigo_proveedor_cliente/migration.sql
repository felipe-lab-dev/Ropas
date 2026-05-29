-- 20260530_codigo_proveedor_cliente
-- Agrega un código legible autogenerado a proveedores (PR#####) y clientes (CL#####).
--
-- Características:
--   • Idempotente: ADD COLUMN IF NOT EXISTS + CREATE INDEX guardado por pg_indexes.
--   • Soft-delete safe: el índice único es parcial (WHERE codigo IS NOT NULL) y el
--     backfill incluye filas eliminadas para que los correlativos nunca se reutilicen.
--   • Tolerante a tenants viejos: todo va envuelto en IF EXISTS (proveedores/clientes
--     no existen en todos los schemas tenant_*).
--   • Usa nombres reales de columna en la BD (creado_en, no creadoEn).
--   • El UPDATE de backfill va en EXECUTE dinámico para evitar el error de plan-caching
--     de PL/pgSQL al referenciar la columna "codigo" recién creada en el mismo bloque.
--
-- Aplicar con: pnpm --dir backend migrar:codigo-entidades
--          o:  pnpm --dir backend exec tsx scripts/aplicar-migracion-codigo-entidades.ts --tenant tenant_mi_tienda

-- ── Proveedores: PR00001 ───────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'proveedores'
  ) THEN
    ALTER TABLE "proveedores" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(20);

    EXECUTE '
      WITH ordenados AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en ASC, id ASC) AS rn
        FROM proveedores
        WHERE codigo IS NULL
      )
      UPDATE proveedores p
      SET codigo = ''PR'' || LPAD(o.rn::text, 5, ''0'')
      FROM ordenados o
      WHERE p.id = o.id';

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname = 'proveedores_codigo_key'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX proveedores_codigo_key ON proveedores (codigo) WHERE codigo IS NOT NULL';
    END IF;
  END IF;
END $$;

-- ── Clientes: CL00001 ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'clientes'
  ) THEN
    ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "codigo" VARCHAR(20);

    EXECUTE '
      WITH ordenados AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en ASC, id ASC) AS rn
        FROM clientes
        WHERE codigo IS NULL
      )
      UPDATE clientes c
      SET codigo = ''CL'' || LPAD(o.rn::text, 5, ''0'')
      FROM ordenados o
      WHERE c.id = o.id';

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = current_schema() AND indexname = 'clientes_codigo_key'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX clientes_codigo_key ON clientes (codigo) WHERE codigo IS NOT NULL';
    END IF;
  END IF;
END $$;
