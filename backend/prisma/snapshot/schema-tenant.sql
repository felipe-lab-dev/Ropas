-- GENERADO AUTOMÁTICAMENTE — NO EDITAR A MANO.
-- Regenerar con `pnpm schema:snapshot`.
-- Generado el: 2026-05-27T16:31:22.280Z

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "genero" AS ENUM ('hombre', 'mujer', 'ninio', 'ninia', 'unisex');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "clasificacion_abc" AS ENUM ('AA', 'A', 'B', 'C', 'D');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "temporada" AS ENUM ('primavera', 'verano', 'otonio', 'invierno', 'todo_el_anio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_movimiento_stock" AS ENUM ('ingreso_compra', 'ingreso_devolucion', 'ingreso_ajuste', 'egreso_venta', 'egreso_merma', 'egreso_ajuste', 'traslado_salida', 'traslado_entrada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_documento" AS ENUM ('dni', 'carne_extranjeria', 'ruc', 'pasaporte', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_venta" AS ENUM ('borrador', 'confirmada', 'pagada', 'parcial', 'anulada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "medio_pago" AS ENUM ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'pix', 'transferencia', 'yape', 'plin', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_nota_credito" AS ENUM ('emitida', 'anulada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_sesion_caja" AS ENUM ('abierta', 'cerrada', 'con_diferencia');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_movimiento_caja" AS ENUM ('ingreso', 'egreso', 'retiro', 'ajuste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "condicion_pago" AS ENUM ('contado', 'credito_15', 'credito_30', 'credito_60', 'credito_otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_comprobante_compra" AS ENUM ('factura', 'boleta', 'nota_ingreso', 'guia_remision', 'recibo_honorarios', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_compra" AS ENUM ('borrador', 'recibida', 'anulada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_pago_compra" AS ENUM ('pendiente', 'parcial', 'pagada', 'vencida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "naturaleza_cuenta" AS ENUM ('deudora', 'acreedora');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_cuenta" AS ENUM ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo', 'orden');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_periodo" AS ENUM ('abierto', 'cerrado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_asiento" AS ENUM ('asentado', 'anulado', 'revertido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_operacion_sunat" AS ENUM ('venta_gravada', 'venta_exonerada', 'venta_inafecta', 'venta_exportacion', 'compra_gravada', 'compra_no_gravada', 'compra_importacion', 'pago_proveedor', 'cobro_cliente', 'apertura_caja', 'cierre_caja', 'gasto_caja', 'ajuste_inventario', 'nota_credito', 'nota_debito', 'asiento_manual', 'asiento_cierre');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_descuento_cupon" AS ENUM ('porcentaje', 'monto_fijo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_cupon" AS ENUM ('activo', 'pausado', 'expirado', 'agotado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "segmento_cupon" AS ENUM ('todos', 'vip_aa', 'vip_a', 'vip_b', 'vip_c', 'lista_clientes', 'nuevos_clientes', 'reactivacion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "aplicable_a_cupon" AS ENUM ('toda_compra', 'categorias', 'productos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_cpe" AS ENUM ('factura', 'boleta', 'nota_credito', 'nota_debito', 'guia_remitente', 'guia_transportista');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_afectacion_igv" AS ENUM ('gravado_onerosa', 'gravado_retiro_premio', 'gravado_retiro_donacion', 'gravado_retiro', 'gravado_retiro_publicidad', 'gravado_bonificaciones', 'gravado_retiro_trabajadores', 'gravado_ivap', 'exonerado_onerosa', 'exonerado_transferencia_gratuita', 'inafecto_onerosa', 'inafecto_retiro_bonificacion', 'inafecto_retiro', 'inafecto_retiro_muestras', 'inafecto_retiro_convenio', 'inafecto_retiro_premio', 'inafecto_retiro_publicidad', 'inafecto_transf_gratuita_no_grav', 'exportacion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "tipo_nota_credito" AS ENUM ('anulacion_operacion', 'anulacion_error_ruc', 'correccion_descripcion', 'descuento_global', 'descuento_item', 'devolucion_total', 'devolucion_item', 'bonificacion', 'disminucion_valor', 'otros_conceptos', 'ajustes_exportacion', 'ajustes_montos_fechas_pago', 'ajustes_intereses_penalidades');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "estado_sunat" AS ENUM ('pendiente', 'en_proceso', 'aceptado', 'aceptado_observado', 'rechazado', 'anulado', 'baja_pendiente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "usuarios" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "dni" VARCHAR(20),
    "password_hash" VARCHAR(120) NOT NULL,
    "rol_id" UUID NOT NULL,
    "sucursal_defecto" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_ingreso" TIMESTAMP(3),
    "preferencias_ui" JSONB NOT NULL DEFAULT '{}',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "roles" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(240),
    "permisos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sucursales" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "direccion" VARCHAR(240),
    "direccion_fiscal" VARCHAR(240),
    "ubigeo_codigo" VARCHAR(6),
    "codigo_anexo_sunat" VARCHAR(4) NOT NULL DEFAULT '0000',
    "telefono" VARCHAR(40),
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "categorias" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "padre_id" UUID,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "icono" VARCHAR(40),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "marcas" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "logo_url" VARCHAR(240),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "marcas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "productos" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "codigo" VARCHAR(40),
    "nombre" VARCHAR(160) NOT NULL,
    "descripcion" TEXT,
    "categoria_id" UUID NOT NULL,
    "marca_id" UUID,
    "genero" "genero" NOT NULL DEFAULT 'unisex',
    "temporada" "temporada" NOT NULL DEFAULT 'todo_el_anio',
    "material" VARCHAR(120),
    "cuidado" VARCHAR(240),
    "precio_venta" DECIMAL(12,2) NOT NULL,
    "precio_compra" DECIMAL(12,2),
    "unidad_medida_codigo" VARCHAR(10) DEFAULT 'NIU',
    "tipo_afectacion_igv" "tipo_afectacion_igv" NOT NULL DEFAULT 'gravado_onerosa',
    "imagenes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "clasificacion" "clasificacion_abc",
    "clasificacion_score" DECIMAL(12,4),
    "clasificado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "variantes" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "sku" VARCHAR(48) NOT NULL,
    "talla" VARCHAR(16) NOT NULL,
    "color" VARCHAR(40) NOT NULL,
    "color_hex" VARCHAR(7),
    "codigo_barras" VARCHAR(40),
    "precio_venta" DECIMAL(12,2),
    "peso_gramos" INTEGER,
    "imagenes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "variantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_sucursales" (
    "id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "disponible" INTEGER NOT NULL DEFAULT 0,
    "reservado" INTEGER NOT NULL DEFAULT 0,
    "en_revision" INTEGER NOT NULL DEFAULT 0,
    "danado" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "ubicacion" VARCHAR(40),
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "movimientos_stock" (
    "id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "tipo" "tipo_movimiento_stock" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stock_antes" INTEGER NOT NULL,
    "stock_despues" INTEGER NOT NULL,
    "referencia_tipo" VARCHAR(40),
    "referencia_id" UUID,
    "notas" TEXT,
    "usuario_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "clientes" (
    "id" UUID NOT NULL,
    "tipo_documento" "tipo_documento" NOT NULL DEFAULT 'dni',
    "documento" VARCHAR(20),
    "nombre" VARCHAR(160) NOT NULL,
    "email" VARCHAR(160),
    "telefono" VARCHAR(40),
    "direccion" VARCHAR(240),
    "ciudad" VARCHAR(120),
    "ubigeo_codigo" VARCHAR(6),
    "fecha_nacimiento" DATE,
    "notas" TEXT,
    "total_compras" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ultima_compra_en" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clasificacion" "clasificacion_abc",
    "clasificacion_score" DECIMAL(12,4),
    "clasificado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ventas" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "cliente_id" UUID,
    "vendedor_id" UUID NOT NULL,
    "estado" "estado_venta" NOT NULL DEFAULT 'confirmada',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento_cupon" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cupon_id" UUID,
    "cupon_codigo" VARCHAR(40),
    "impuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "total_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "sesion_caja_id" UUID,
    "tipo_cpe" "tipo_cpe",
    "serie_cpe_id" UUID,
    "correlativo" VARCHAR(8),
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "tipo_cambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "fecha_vencimiento" DATE,
    "codigo_tipo_operacion_sunat" VARCHAR(4) NOT NULL DEFAULT '0101',
    "anulada_en" TIMESTAMP(3),
    "motivo_anulacion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "venta_items" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "descripcion" VARCHAR(240) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notas_credito" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "venta_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "cliente_id" UUID,
    "emitida_por_id" UUID NOT NULL,
    "estado" "estado_nota_credito" NOT NULL DEFAULT 'emitida',
    "motivo" TEXT NOT NULL,
    "codigo_tipo_nc" "tipo_nota_credito" NOT NULL DEFAULT 'devolucion_total',
    "tipo_cpe_original" "tipo_cpe",
    "serie_cpe_original" VARCHAR(4),
    "correlativo_cpe_original" VARCHAR(8),
    "tipo_cpe" "tipo_cpe",
    "serie_cpe_id" UUID,
    "correlativo" VARCHAR(8),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "restituye_stock" BOOLEAN NOT NULL DEFAULT true,
    "anulada_en" TIMESTAMP(3),
    "motivo_anulacion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "notas_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notas_credito_items" (
    "id" UUID NOT NULL,
    "nota_credito_id" UUID NOT NULL,
    "venta_item_id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "descripcion" VARCHAR(240) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "notas_credito_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "venta_pagos" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "medio" "medio_pago" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "referencia" VARCHAR(120),
    "recibido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sesiones_caja" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "cajero_id" UUID NOT NULL,
    "estado" "estado_sesion_caja" NOT NULL DEFAULT 'abierta',
    "monto_apertura" DECIMAL(12,2) NOT NULL,
    "monto_cierre" DECIMAL(12,2),
    "monto_esperado" DECIMAL(12,2),
    "diferencia" DECIMAL(12,2),
    "notas_apertura" TEXT,
    "notas_cierre" TEXT,
    "abierta_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrada_en" TIMESTAMP(3),

    CONSTRAINT "sesiones_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "movimientos_caja" (
    "id" UUID NOT NULL,
    "sesion_id" UUID NOT NULL,
    "tipo" "tipo_movimiento_caja" NOT NULL,
    "medio" "medio_pago" NOT NULL DEFAULT 'efectivo',
    "monto" DECIMAL(12,2) NOT NULL,
    "motivo" VARCHAR(240) NOT NULL,
    "comprobante" VARCHAR(60),
    "contraparte" VARCHAR(180),
    "creado_por_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "modulo" VARCHAR(40) NOT NULL,
    "accion" VARCHAR(40) NOT NULL,
    "entidad_id" UUID,
    "usuario_id" UUID,
    "cambios" JSONB,
    "ip" VARCHAR(45),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "proveedores" (
    "id" UUID NOT NULL,
    "tipo_documento" "tipo_documento" NOT NULL DEFAULT 'ruc',
    "documento" VARCHAR(20) NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nombre_comercial" VARCHAR(160),
    "contacto" VARCHAR(120),
    "email" VARCHAR(160),
    "telefono" VARCHAR(40),
    "direccion" VARCHAR(240),
    "ciudad" VARCHAR(120),
    "condicion_pago" "condicion_pago" NOT NULL DEFAULT 'contado',
    "dias_credito" INTEGER NOT NULL DEFAULT 0,
    "cuenta_bancaria" VARCHAR(60),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "total_comprado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deuda_actual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ultima_compra_en" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "compras" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "tipo_comprobante" "tipo_comprobante_compra" NOT NULL,
    "serie" VARCHAR(10) NOT NULL,
    "numero_comprobante" VARCHAR(20) NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "fecha_recepcion" DATE NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "tipo_cambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "igv" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otros_impuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "estado" "estado_compra" NOT NULL DEFAULT 'borrador',
    "estado_pago" "estado_pago_compra" NOT NULL DEFAULT 'pendiente',
    "condicion_pago" "condicion_pago" NOT NULL DEFAULT 'contado',
    "fecha_vencimiento" DATE,
    "total_pagado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "usuario_id" UUID NOT NULL,
    "anulada_en" TIMESTAMP(3),
    "motivo_anulacion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "compra_items" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "descripcion" VARCHAR(240) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(14,4) NOT NULL,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pagos_compra" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "medio" "medio_pago" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "referencia" VARCHAR(120),
    "fecha_pago" DATE NOT NULL,
    "sesion_caja_id" UUID,
    "usuario_id" UUID NOT NULL,
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "pagos_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "plan_cuentas" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(12) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "nivel" INTEGER NOT NULL,
    "padre_codigo" VARCHAR(12),
    "naturaleza" "naturaleza_cuenta" NOT NULL,
    "tipo" "tipo_cuenta" NOT NULL,
    "acepta_movimiento" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "periodos_contables" (
    "id" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" "estado_periodo" NOT NULL DEFAULT 'abierto',
    "cerrado_en" TIMESTAMP(3),
    "cerrado_por_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asientos_contables" (
    "id" UUID NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "periodo_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "glosa" VARCHAR(400) NOT NULL,
    "tipo_operacion" "tipo_operacion_sunat" NOT NULL,
    "origen_tipo" VARCHAR(40),
    "origen_id" UUID,
    "total_debe" DECIMAL(14,2) NOT NULL,
    "total_haber" DECIMAL(14,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "tipo_cambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "estado" "estado_asiento" NOT NULL DEFAULT 'asentado',
    "reversa_de_id" UUID,
    "usuario_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asientos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asiento_detalles" (
    "id" UUID NOT NULL,
    "asiento_id" UUID NOT NULL,
    "cuenta_codigo" VARCHAR(12) NOT NULL,
    "glosa" VARCHAR(240),
    "debe" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "documento_tipo" VARCHAR(10),
    "documento_numero" VARCHAR(30),
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "asiento_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cupones" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "descripcion" TEXT,
    "tipo_descuento" "tipo_descuento_cupon" NOT NULL,
    "valor_descuento" DECIMAL(12,2) NOT NULL,
    "monto_minimo_compra" DECIMAL(12,2),
    "descuento_maximo" DECIMAL(12,2),
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "usos_maximos_total" INTEGER,
    "usos_maximos_por_cliente" INTEGER NOT NULL DEFAULT 1,
    "segmento" "segmento_cupon" NOT NULL DEFAULT 'todos',
    "clientes_elegibles_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "aplicable_a" "aplicable_a_cupon" NOT NULL DEFAULT 'toda_compra',
    "categorias_aplicables_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "productos_aplicables_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "campania" VARCHAR(120),
    "plantilla" VARCHAR(60),
    "estado" "estado_cupon" NOT NULL DEFAULT 'activo',
    "pausado_en" TIMESTAMP(3),
    "diseno_color_primario" VARCHAR(9) NOT NULL DEFAULT '#7c3aed',
    "diseno_color_secundario" VARCHAR(9) NOT NULL DEFAULT '#1e1b4b',
    "diseno_mensaje" VARCHAR(240),
    "diseno_emoji" VARCHAR(8),
    "creado_por_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "eliminado_en" TIMESTAMP(3),

    CONSTRAINT "cupones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cupones_usos" (
    "id" UUID NOT NULL,
    "cupon_id" UUID NOT NULL,
    "cliente_id" UUID,
    "venta_id" UUID NOT NULL,
    "monto_descuento" DECIMAL(12,2) NOT NULL,
    "monto_venta" DECIMAL(12,2) NOT NULL,
    "aplicado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupones_usos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "series_cpe" (
    "id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "tipo_cpe" "tipo_cpe" NOT NULL,
    "aplica_a" "tipo_cpe",
    "serie" VARCHAR(4) NOT NULL,
    "correlativo_actual" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_cpe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "documentos_electronicos" (
    "id" UUID NOT NULL,
    "venta_id" UUID,
    "nota_credito_id" UUID,
    "tipo_cpe" "tipo_cpe" NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "correlativo" VARCHAR(8) NOT NULL,
    "estado_sunat" "estado_sunat" NOT NULL DEFAULT 'pendiente',
    "codigo_hash" VARCHAR(200),
    "cadena_qr" TEXT,
    "mensaje_sunat" TEXT,
    "xml_enviado_url" VARCHAR(500),
    "cdr_url" VARCHAR(500),
    "pdf_url" VARCHAR(500),
    "num_intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimo_error_texto" TEXT,
    "enviado_en" TIMESTAMP(3),
    "aceptado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_electronicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "configuracion_facturacion" (
    "id" UUID NOT NULL,
    "mifact_token_cifrado" TEXT NOT NULL,
    "mifact_base_url" VARCHAR(200) NOT NULL DEFAULT 'https://demo.mifact.net.pe/api',
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nombre_comercial" VARCHAR(200),
    "direccion_fiscal" VARCHAR(240) NOT NULL,
    "ubigeo_fiscal_codigo" VARCHAR(6) NOT NULL,
    "enviar_automatico_a_sunat" BOOLEAN NOT NULL DEFAULT true,
    "retornar_pdf" BOOLEAN NOT NULL DEFAULT true,
    "retornar_xml_envio" BOOLEAN NOT NULL DEFAULT false,
    "retornar_xml_cdr" BOOLEAN NOT NULL DEFAULT false,
    "formato_impresion" VARCHAR(3) NOT NULL DEFAULT '001',
    "emitir_al_confirmar" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_facturacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_dni_key" ON "usuarios"("dni");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usuarios_eliminado_en_idx" ON "usuarios"("eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sucursales_codigo_key" ON "sucursales"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "categorias_slug_key" ON "categorias"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "marcas_nombre_key" ON "marcas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "productos_sku_key" ON "productos"("sku");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "productos_codigo_key" ON "productos"("codigo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "productos_eliminado_en_idx" ON "productos"("eliminado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "productos_categoria_id_idx" ON "productos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "variantes_sku_key" ON "variantes"("sku");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "variantes_codigo_barras_key" ON "variantes"("codigo_barras");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "variantes_eliminado_en_idx" ON "variantes"("eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "variantes_producto_id_talla_color_key" ON "variantes"("producto_id", "talla", "color");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_sucursales_sucursal_id_idx" ON "stock_sucursales"("sucursal_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stock_sucursales_variante_id_sucursal_id_key" ON "stock_sucursales"("variante_id", "sucursal_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "movimientos_stock_variante_id_creado_en_idx" ON "movimientos_stock"("variante_id", "creado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "movimientos_stock_referencia_tipo_referencia_id_idx" ON "movimientos_stock"("referencia_tipo", "referencia_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clientes_eliminado_en_idx" ON "clientes"("eliminado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clientes_clasificacion_idx" ON "clientes"("clasificacion");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_tipo_documento_documento_key" ON "clientes"("tipo_documento", "documento");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ventas_numero_key" ON "ventas"("numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ventas_sucursal_id_creado_en_idx" ON "ventas"("sucursal_id", "creado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ventas_cupon_id_idx" ON "ventas"("cupon_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ventas_eliminado_en_idx" ON "ventas"("eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ventas_tipo_cpe_serie_cpe_id_correlativo_key" ON "ventas"("tipo_cpe", "serie_cpe_id", "correlativo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "venta_items_venta_id_idx" ON "venta_items"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notas_credito_numero_key" ON "notas_credito"("numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_credito_venta_id_idx" ON "notas_credito"("venta_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_credito_cliente_id_idx" ON "notas_credito"("cliente_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_credito_eliminado_en_idx" ON "notas_credito"("eliminado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_credito_items_nota_credito_id_idx" ON "notas_credito_items"("nota_credito_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_credito_items_venta_item_id_idx" ON "notas_credito_items"("venta_item_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "venta_pagos_venta_id_idx" ON "venta_pagos"("venta_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sesiones_caja_sucursal_id_abierta_en_idx" ON "sesiones_caja"("sucursal_id", "abierta_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "movimientos_caja_sesion_id_creado_en_idx" ON "movimientos_caja"("sesion_id", "creado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "movimientos_caja_sesion_id_tipo_idx" ON "movimientos_caja"("sesion_id", "tipo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_log_modulo_creado_en_idx" ON "audit_log"("modulo", "creado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "proveedores_eliminado_en_idx" ON "proveedores"("eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "proveedores_tipo_documento_documento_key" ON "proveedores"("tipo_documento", "documento");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "compras_numero_key" ON "compras"("numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "compras_sucursal_id_fecha_emision_idx" ON "compras"("sucursal_id", "fecha_emision");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "compras_estado_pago_fecha_vencimiento_idx" ON "compras"("estado_pago", "fecha_vencimiento");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "compras_eliminado_en_idx" ON "compras"("eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "compras_proveedor_id_tipo_comprobante_serie_numero_comproba_key" ON "compras"("proveedor_id", "tipo_comprobante", "serie", "numero_comprobante");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "compra_items_compra_id_idx" ON "compra_items"("compra_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pagos_compra_compra_id_idx" ON "pagos_compra"("compra_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "plan_cuentas_codigo_key" ON "plan_cuentas"("codigo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "plan_cuentas_padre_codigo_idx" ON "plan_cuentas"("padre_codigo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "plan_cuentas_tipo_idx" ON "plan_cuentas"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "periodos_contables_anio_mes_key" ON "periodos_contables"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "asientos_contables_numero_key" ON "asientos_contables"("numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asientos_contables_periodo_id_fecha_idx" ON "asientos_contables"("periodo_id", "fecha");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asientos_contables_origen_tipo_origen_id_idx" ON "asientos_contables"("origen_tipo", "origen_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asiento_detalles_asiento_id_idx" ON "asiento_detalles"("asiento_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asiento_detalles_cuenta_codigo_idx" ON "asiento_detalles"("cuenta_codigo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "cupones_codigo_key" ON "cupones"("codigo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cupones_codigo_idx" ON "cupones"("codigo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cupones_estado_fecha_fin_idx" ON "cupones"("estado", "fecha_fin");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cupones_eliminado_en_idx" ON "cupones"("eliminado_en");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "cupones_usos_venta_id_key" ON "cupones_usos"("venta_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cupones_usos_cupon_id_aplicado_en_idx" ON "cupones_usos"("cupon_id", "aplicado_en");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cupones_usos_cliente_id_idx" ON "cupones_usos"("cliente_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "series_cpe_sucursal_id_tipo_cpe_aplica_a_idx" ON "series_cpe"("sucursal_id", "tipo_cpe", "aplica_a");

-- Unicidad TOTAL: a lo sumo UNA fila por (sucursal, tipoCpe, aplicaA), sin
-- importar `activa`. El toggle activa/inactiva es para "pausar" la serie, no
-- para coexistir con otra del mismo tipo.
-- Dos índices parciales separados porque Postgres trata cada NULL como distinto
-- en UNIQUE normal, así que aplica_a=NULL (factura/boleta/guias) necesita su
-- propio índice condicionado.
CREATE UNIQUE INDEX IF NOT EXISTS "series_cpe_unicidad_sin_aplica_a"
  ON "series_cpe" ("sucursal_id", "tipo_cpe")
  WHERE "aplica_a" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "series_cpe_unicidad_con_aplica_a"
  ON "series_cpe" ("sucursal_id", "tipo_cpe", "aplica_a")
  WHERE "aplica_a" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "documentos_electronicos_venta_id_key" ON "documentos_electronicos"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "documentos_electronicos_nota_credito_id_key" ON "documentos_electronicos"("nota_credito_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "documentos_electronicos_estado_sunat_idx" ON "documentos_electronicos"("estado_sunat");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "documentos_electronicos_tipo_cpe_serie_correlativo_key" ON "documentos_electronicos"("tipo_cpe", "serie", "correlativo");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "marcas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variantes" ADD CONSTRAINT "variantes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_sucursales" ADD CONSTRAINT "stock_sucursales_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_sucursales" ADD CONSTRAINT "stock_sucursales_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sesion_caja_id_fkey" FOREIGN KEY ("sesion_caja_id") REFERENCES "sesiones_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_serie_cpe_id_fkey" FOREIGN KEY ("serie_cpe_id") REFERENCES "series_cpe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_emitida_por_id_fkey" FOREIGN KEY ("emitida_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito" ADD CONSTRAINT "notas_credito_serie_cpe_id_fkey" FOREIGN KEY ("serie_cpe_id") REFERENCES "series_cpe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito_items" ADD CONSTRAINT "notas_credito_items_nota_credito_id_fkey" FOREIGN KEY ("nota_credito_id") REFERENCES "notas_credito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito_items" ADD CONSTRAINT "notas_credito_items_venta_item_id_fkey" FOREIGN KEY ("venta_item_id") REFERENCES "venta_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito_items" ADD CONSTRAINT "notas_credito_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_pagos" ADD CONSTRAINT "venta_pagos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_caja" ADD CONSTRAINT "sesiones_caja_cajero_id_fkey" FOREIGN KEY ("cajero_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_sesion_id_fkey" FOREIGN KEY ("sesion_id") REFERENCES "sesiones_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "variantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_compra" ADD CONSTRAINT "pagos_compra_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodos_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_detalles" ADD CONSTRAINT "asiento_detalles_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_detalles" ADD CONSTRAINT "asiento_detalles_cuenta_codigo_fkey" FOREIGN KEY ("cuenta_codigo") REFERENCES "plan_cuentas"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones" ADD CONSTRAINT "cupones_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_usos" ADD CONSTRAINT "cupones_usos_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_usos" ADD CONSTRAINT "cupones_usos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupones_usos" ADD CONSTRAINT "cupones_usos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_cpe" ADD CONSTRAINT "series_cpe_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_electronicos" ADD CONSTRAINT "documentos_electronicos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_electronicos" ADD CONSTRAINT "documentos_electronicos_nota_credito_id_fkey" FOREIGN KEY ("nota_credito_id") REFERENCES "notas_credito"("id") ON DELETE SET NULL ON UPDATE CASCADE;
