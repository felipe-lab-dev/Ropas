import { Injectable } from '@nestjs/common';
import { Prisma, Genero, Temporada, TipoMovimientoStock } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';
import { AzureBlobService } from '../../core/storage/azure-blob.service';
import type { Express } from 'express';
import {
  construirBusquedaWordSplit,
  obtenerPaginacion,
  PaginacionDto,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';
import { CrearProductoDto, CrearVarianteDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import {
  AgregarVarianteDto,
  ActualizarVarianteDto,
} from './dto/variante.dto';

// Advisory-lock key (estable por tenant) para serializar generación de SKU.
const LOCK_KEY_SKU_PRODUCTO = 8_372_481_001;

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaTenantService,
    private readonly blob: AzureBlobService,
  ) {}

  async listar(
    query: PaginacionDto & { categoriaId?: string; marcaId?: string; activo?: string },
    ctx: TenantContext,
  ) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.ProductoWhereInput = { eliminadoEn: null };

    if (query.categoriaId) where.categoriaId = query.categoriaId;
    if (query.marcaId) where.marcaId = query.marcaId;
    if (query.activo !== undefined) where.activo = query.activo === 'true';

    const busqueda = construirBusquedaWordSplit(query.buscar, [
      'nombre',
      'sku',
      'codigo',
      'descripcion',
      'material',
    ]);
    if (busqueda) Object.assign(where, busqueda);

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.producto.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
        include: {
          categoria: { select: { id: true, nombre: true, slug: true, icono: true } },
          marca: { select: { id: true, nombre: true } },
          variantes: {
            where: { eliminadoEn: null },
            select: {
              id: true,
              sku: true,
              talla: true,
              color: true,
              colorHex: true,
              codigoBarras: true,
              precioVenta: true,
              activo: true,
              stocks: {
                select: { sucursalId: true, disponible: true, reservado: true },
              },
            },
          },
        },
      }),
      cliente.producto.count({ where }),
    ]);

    // Agregar cantidadVentas, ventasMensuales (12 meses) y ultimaVentaEn para cada producto.
    const ventasPorProducto = new Map<string, { total: number; mensual: Map<string, number> }>();
    const ultimaVentaPorProducto = new Map<string, Date>();
    const todasLasVarianteIds = datos.flatMap(p => p.variantes.map(v => v.id));
    const varianteAProducto = new Map<string, string>();
    for (const p of datos) for (const v of p.variantes) varianteAProducto.set(v.id, p.id);

    if (todasLasVarianteIds.length > 0) {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 11);
      desde.setDate(1);
      desde.setHours(0, 0, 0, 0);

      // Query 1: items de los últimos 12 meses (para sparkline y total).
      // Query 2: última fecha de venta por variante (sin filtro temporal, para "días estancados").
      const [items, ultimas] = await Promise.all([
        cliente.ventaItem.findMany({
          where: {
            varianteId: { in: todasLasVarianteIds },
            venta: { anuladaEn: null, creadoEn: { gte: desde } },
          },
          select: {
            cantidad: true,
            varianteId: true,
            venta: { select: { creadoEn: true } },
          },
        }),
        cliente.ventaItem.findMany({
          where: {
            varianteId: { in: todasLasVarianteIds },
            venta: { anuladaEn: null },
          },
          select: { varianteId: true, venta: { select: { creadoEn: true } } },
        }),
      ]);

      for (const item of items) {
        const productoId = varianteAProducto.get(item.varianteId);
        if (!productoId) continue;
        const entry = ventasPorProducto.get(productoId) ?? { total: 0, mensual: new Map() };
        entry.total += item.cantidad;
        const fecha = item.venta.creadoEn;
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        entry.mensual.set(key, (entry.mensual.get(key) ?? 0) + item.cantidad);
        ventasPorProducto.set(productoId, entry);
      }

      for (const item of ultimas) {
        const productoId = varianteAProducto.get(item.varianteId);
        if (!productoId) continue;
        const fecha = item.venta.creadoEn;
        const actual = ultimaVentaPorProducto.get(productoId);
        if (!actual || fecha > actual) ultimaVentaPorProducto.set(productoId, fecha);
      }
    }

    // Generar serie de 12 meses (aunque haya ceros) para sparkline estable.
    const ahora = new Date();
    const meses: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const ahoraMs = Date.now();
    const MS_POR_DIA = 1000 * 60 * 60 * 24;
    const conTotales = datos.map(p => {
      const ventas = ventasPorProducto.get(p.id);
      const ultimaVenta = ultimaVentaPorProducto.get(p.id) ?? null;
      // "Estancado" = días desde la última venta. Sin ventas → días desde creación.
      const referencia = ultimaVenta ?? p.creadoEn;
      const diasEstancado = Math.max(0, Math.floor((ahoraMs - referencia.getTime()) / MS_POR_DIA));
      return {
        ...p,
        stockTotal: p.variantes.reduce(
          (acc, v) => acc + v.stocks.reduce((s, st) => s + st.disponible, 0),
          0,
        ),
        cantidadVariantes: p.variantes.length,
        cantidadVentas: ventas?.total ?? 0,
        ventasMensuales: meses.map(mes => ({
          mes,
          cantidad: ventas?.mensual.get(mes) ?? 0,
        })),
        ultimaVentaEn: ultimaVenta,
        diasEstancado,
      };
    });

    return crearResultadoPaginado(conTotales, total, { pagina, limite });
  }

  async obtenerPorId(id: string, ctx: TenantContext) {
    const producto = await this.prisma.forTenant(ctx).producto.findFirst({
      where: { id, eliminadoEn: null },
      include: {
        categoria: true,
        marca: true,
        variantes: {
          where: { eliminadoEn: null },
          include: { stocks: { include: { sucursal: true } } },
          orderBy: [{ talla: 'asc' }, { color: 'asc' }],
        },
      },
    });
    if (!producto) throw new ErrorNoEncontrado('Producto no encontrado');
    return producto;
  }

  async crear(dto: CrearProductoDto, ctx: TenantContext, usuarioId?: string) {
    if (!dto.variantes || dto.variantes.length === 0) {
      throw new ErrorValidacion('Debe incluir al menos una variante');
    }

    // Validar que no haya pares (talla,color) duplicados en el payload.
    const claves = new Set<string>();
    for (const v of dto.variantes) {
      const k = `${v.talla.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`;
      if (claves.has(k)) {
        throw new ErrorValidacion(
          `Variante duplicada: ${v.talla} · ${v.color}. Cada combinación talla+color debe ser única.`,
        );
      }
      claves.add(k);
    }

    const cliente = this.prisma.forTenant(ctx);

    // Validaciones de FKs (mejor error que un 500 por violación de constraint).
    const categoria = await cliente.categoria.findFirst({
      where: { id: dto.categoriaId, eliminadoEn: null },
      select: { id: true },
    });
    if (!categoria) throw new ErrorValidacion('Categoría no existe o fue eliminada');

    if (dto.marcaId) {
      const marca = await cliente.marca.findFirst({
        where: { id: dto.marcaId, eliminadoEn: null },
        select: { id: true },
      });
      if (!marca) throw new ErrorValidacion('Marca no existe o fue eliminada');
    }

    // Resolver sucursal por defecto (para stock inicial) si alguna variante lo trae.
    const necesitaSucursalDefault = dto.variantes.some(
      v => (v.stockInicial ?? 0) > 0 && !v.sucursalId,
    );
    let sucursalDefault: { id: string } | null = null;
    if (necesitaSucursalDefault) {
      if (dto.sucursalId) {
        sucursalDefault = await cliente.sucursal.findFirst({
          where: { id: dto.sucursalId, eliminadoEn: null, activa: true },
          select: { id: true },
        });
        if (!sucursalDefault) throw new ErrorValidacion('Sucursal indicada no existe o no está activa');
      } else {
        sucursalDefault =
          (await cliente.sucursal.findFirst({
            where: { eliminadoEn: null, activa: true, esPrincipal: true },
            select: { id: true },
          })) ??
          (await cliente.sucursal.findFirst({
            where: { eliminadoEn: null, activa: true },
            select: { id: true },
            orderBy: { creadoEn: 'asc' },
          }));
        if (!sucursalDefault) {
          throw new ErrorValidacion(
            'No hay sucursal activa para cargar el stock inicial. Crea una sucursal primero.',
          );
        }
      }
    }

    return cliente.$transaction(async tx => {
      // Lock advisory por tenant: serializa generación de SKU correlativo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY_SKU_PRODUCTO})`;

      const sku = dto.sku?.trim() || (await this.siguienteSkuAutoEnTx(tx));

      const skuExiste = await tx.producto.findFirst({
        where: { sku, eliminadoEn: null },
        select: { id: true },
      });
      if (skuExiste) throw new ErrorConflicto(`SKU "${sku}" ya existe`);

      if (dto.codigo?.trim()) {
        const codigoExiste = await tx.producto.findFirst({
          where: { codigo: dto.codigo.trim(), eliminadoEn: null },
          select: { id: true },
        });
        if (codigoExiste) throw new ErrorConflicto(`Código "${dto.codigo.trim()}" ya existe`);
      }

      const producto = await tx.producto.create({
        data: {
          sku,
          codigo: dto.codigo?.trim() || null,
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion?.trim() || null,
          categoriaId: dto.categoriaId,
          marcaId: dto.marcaId,
          genero: (dto.genero ?? 'unisex') as Genero,
          temporada: (dto.temporada ?? 'todo_el_anio') as Temporada,
          material: dto.material?.trim() || null,
          cuidado: dto.cuidado?.trim() || null,
          precioVenta: dto.precioVenta,
          precioCompra: dto.precioCompra,
          imagenes: dto.imagenes ?? [],
          tags: dto.tags ?? [],
        },
      });

      for (const [i, v] of dto.variantes.entries()) {
        const varianteSku = v.sku?.trim() || `${sku}-${String(i + 1).padStart(2, '0')}`;
        const variante = await tx.variante.create({
          data: {
            productoId: producto.id,
            sku: varianteSku,
            talla: v.talla.trim(),
            color: v.color.trim(),
            colorHex: v.colorHex,
            codigoBarras: v.codigoBarras?.trim() || null,
            precioVenta: v.precioVenta,
            pesoGramos: v.pesoGramos,
          },
        });

        const stockInicial = v.stockInicial ?? 0;
        if (stockInicial > 0) {
          const sucursalId = v.sucursalId ?? sucursalDefault!.id;
          await tx.stockSucursal.create({
            data: { varianteId: variante.id, sucursalId, disponible: stockInicial },
          });
          await tx.movimientoStock.create({
            data: {
              varianteId: variante.id,
              sucursalId,
              tipo: TipoMovimientoStock.ingreso_ajuste,
              cantidad: stockInicial,
              stockAntes: 0,
              stockDespues: stockInicial,
              notas: 'Stock inicial al crear producto',
              usuarioId,
            },
          });
        }
      }

      return tx.producto.findFirstOrThrow({
        where: { id: producto.id },
        include: {
          variantes: { include: { stocks: { include: { sucursal: true } } } },
          categoria: true,
          marca: true,
        },
      });
    });
  }

  /** Genera siguiente SKU correlativo "P-00001" único por tenant, dentro de la transacción. */
  private async siguienteSkuAutoEnTx(tx: Prisma.TransactionClient): Promise<string> {
    const ultimo = await tx.producto.findFirst({
      where: { sku: { startsWith: 'P-' } },
      orderBy: { sku: 'desc' },
      select: { sku: true },
    });
    let n = 1;
    if (ultimo) {
      const m = ultimo.sku.match(/^P-(\d+)$/);
      if (m && m[1]) n = parseInt(m[1], 10) + 1;
    }
    return `P-${String(n).padStart(5, '0')}`;
  }

  async actualizar(id: string, dto: ActualizarProductoDto, ctx: TenantContext) {
    const existente = await this.obtenerPorId(id, ctx);
    const cliente = this.prisma.forTenant(ctx);

    if (dto.categoriaId && dto.categoriaId !== existente.categoriaId) {
      const cat = await cliente.categoria.findFirst({
        where: { id: dto.categoriaId, eliminadoEn: null },
        select: { id: true },
      });
      if (!cat) throw new ErrorValidacion('Categoría no existe o fue eliminada');
    }

    if (dto.marcaId && dto.marcaId !== existente.marcaId) {
      const marca = await cliente.marca.findFirst({
        where: { id: dto.marcaId, eliminadoEn: null },
        select: { id: true },
      });
      if (!marca) throw new ErrorValidacion('Marca no existe o fue eliminada');
    }

    if (dto.codigo !== undefined && dto.codigo !== null && dto.codigo.trim() !== '') {
      const codigo = dto.codigo.trim();
      if (codigo !== existente.codigo) {
        const ocupa = await cliente.producto.findFirst({
          where: { codigo, eliminadoEn: null, id: { not: id } },
          select: { id: true },
        });
        if (ocupa) throw new ErrorConflicto(`Código "${codigo}" ya existe`);
      }
    }

    const data: Prisma.ProductoUpdateInput = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo?.trim() || null;
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion?.trim() || null;
    if (dto.categoriaId !== undefined) data.categoria = { connect: { id: dto.categoriaId } };
    if (dto.marcaId !== undefined) {
      data.marca = dto.marcaId ? { connect: { id: dto.marcaId } } : { disconnect: true };
    }
    if (dto.genero !== undefined) data.genero = dto.genero as Genero;
    if (dto.temporada !== undefined) data.temporada = dto.temporada as Temporada;
    if (dto.material !== undefined) data.material = dto.material?.trim() || null;
    if (dto.cuidado !== undefined) data.cuidado = dto.cuidado?.trim() || null;
    if (dto.precioVenta !== undefined) data.precioVenta = dto.precioVenta;
    if (dto.precioCompra !== undefined) data.precioCompra = dto.precioCompra;
    if (dto.imagenes !== undefined) data.imagenes = dto.imagenes;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.activo !== undefined) data.activo = dto.activo;

    return cliente.producto.update({
      where: { id },
      data,
      include: { variantes: { where: { eliminadoEn: null } } },
    });
  }

  async eliminar(id: string, ctx: TenantContext) {
    await this.obtenerPorId(id, ctx);
    const cliente = this.prisma.forTenant(ctx);
    const ahora = new Date();
    await cliente.$transaction([
      cliente.variante.updateMany({
        where: { productoId: id, eliminadoEn: null },
        data: { eliminadoEn: ahora, activo: false },
      }),
      cliente.producto.update({
        where: { id },
        data: { eliminadoEn: ahora, activo: false },
      }),
    ]);
  }

  // ─── Variantes ────────────────────────────────────────────────────────────

  async agregarVariante(
    productoId: string,
    dto: AgregarVarianteDto,
    ctx: TenantContext,
    usuarioId?: string,
  ) {
    const producto = await this.obtenerPorId(productoId, ctx);
    const cliente = this.prisma.forTenant(ctx);

    const talla = dto.talla.trim();
    const color = dto.color.trim();
    const duplicada = producto.variantes.find(
      v =>
        v.talla.trim().toLowerCase() === talla.toLowerCase() &&
        v.color.trim().toLowerCase() === color.toLowerCase(),
    );
    if (duplicada) {
      throw new ErrorConflicto(`Ya existe una variante ${talla} · ${color} en este producto`);
    }

    const stockInicial = dto.stockInicial ?? 0;
    let sucursalId = dto.sucursalId;
    if (stockInicial > 0 && !sucursalId) {
      const sucursal =
        (await cliente.sucursal.findFirst({
          where: { eliminadoEn: null, activa: true, esPrincipal: true },
          select: { id: true },
        })) ??
        (await cliente.sucursal.findFirst({
          where: { eliminadoEn: null, activa: true },
          select: { id: true },
          orderBy: { creadoEn: 'asc' },
        }));
      if (!sucursal) throw new ErrorValidacion('No hay sucursal activa para cargar el stock inicial.');
      sucursalId = sucursal.id;
    }

    return cliente.$transaction(async tx => {
      const indice = producto.variantes.length + 1;
      const sku = dto.sku?.trim() || `${producto.sku}-${String(indice).padStart(2, '0')}`;

      const skuExiste = await tx.variante.findFirst({
        where: { sku, eliminadoEn: null },
        select: { id: true },
      });
      if (skuExiste) throw new ErrorConflicto(`SKU de variante "${sku}" ya existe`);

      const variante = await tx.variante.create({
        data: {
          productoId,
          sku,
          talla,
          color,
          colorHex: dto.colorHex,
          codigoBarras: dto.codigoBarras?.trim() || null,
          precioVenta: dto.precioVenta,
          pesoGramos: dto.pesoGramos,
        },
      });

      if (stockInicial > 0 && sucursalId) {
        await tx.stockSucursal.create({
          data: { varianteId: variante.id, sucursalId, disponible: stockInicial },
        });
        await tx.movimientoStock.create({
          data: {
            varianteId: variante.id,
            sucursalId,
            tipo: TipoMovimientoStock.ingreso_ajuste,
            cantidad: stockInicial,
            stockAntes: 0,
            stockDespues: stockInicial,
            notas: 'Stock inicial al agregar variante',
            usuarioId,
          },
        });
      }

      return tx.variante.findFirstOrThrow({
        where: { id: variante.id },
        include: { stocks: { include: { sucursal: true } } },
      });
    });
  }

  async actualizarVariante(
    productoId: string,
    varianteId: string,
    dto: ActualizarVarianteDto,
    ctx: TenantContext,
  ) {
    const cliente = this.prisma.forTenant(ctx);
    const variante = await cliente.variante.findFirst({
      where: { id: varianteId, productoId, eliminadoEn: null },
    });
    if (!variante) throw new ErrorNoEncontrado('Variante no encontrada');

    if (
      (dto.talla !== undefined && dto.talla.trim() !== variante.talla) ||
      (dto.color !== undefined && dto.color.trim() !== variante.color)
    ) {
      const talla = dto.talla?.trim() ?? variante.talla;
      const color = dto.color?.trim() ?? variante.color;
      const choca = await cliente.variante.findFirst({
        where: {
          productoId,
          eliminadoEn: null,
          id: { not: varianteId },
          talla,
          color,
        },
        select: { id: true },
      });
      if (choca) throw new ErrorConflicto(`Ya existe una variante ${talla} · ${color}`);
    }

    return cliente.variante.update({
      where: { id: varianteId },
      data: {
        talla: dto.talla?.trim(),
        color: dto.color?.trim(),
        colorHex: dto.colorHex,
        codigoBarras: dto.codigoBarras === undefined
          ? undefined
          : (dto.codigoBarras?.trim() || null),
        precioVenta: dto.precioVenta,
        pesoGramos: dto.pesoGramos,
        activo: dto.activo,
      },
      include: { stocks: { include: { sucursal: true } } },
    });
  }

  async eliminarVariante(productoId: string, varianteId: string, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const variante = await cliente.variante.findFirst({
      where: { id: varianteId, productoId, eliminadoEn: null },
      include: { stocks: true },
    });
    if (!variante) throw new ErrorNoEncontrado('Variante no encontrada');

    const stockTotal = variante.stocks.reduce((acc, s) => acc + s.disponible, 0);
    if (stockTotal > 0) {
      throw new ErrorConflicto(
        `No se puede eliminar: la variante aún tiene ${stockTotal} unidades en stock. Primero ajusta el stock a 0 en Inventario.`,
      );
    }

    // Si es la última variante viva del producto, también bloqueamos para forzar
    // eliminar el producto en su lugar (mejor consistencia).
    const vivas = await cliente.variante.count({
      where: { productoId, eliminadoEn: null, id: { not: varianteId } },
    });
    if (vivas === 0) {
      throw new ErrorConflicto(
        'Es la única variante. Elimina el producto completo en lugar de la variante.',
      );
    }

    await cliente.variante.update({
      where: { id: varianteId },
      data: { eliminadoEn: new Date(), activo: false },
    });
  }

  // ─── Kardex ───────────────────────────────────────────────────────────────

  /**
   * Kardex de un producto: historial de movimientos de stock (entradas y salidas)
   * de todas sus variantes, con resolución del documento de referencia (compra/venta).
   *
   * Filtros: fechaIni, fechaFin, tipo (entradas|salidas|ambas), varianteId, sucursalId.
   */
  async kardex(
    productoId: string,
    query: {
      fechaIni?: string;
      fechaFin?: string;
      tipo?: 'entradas' | 'salidas' | 'ambas';
      varianteId?: string;
      sucursalId?: string;
    } & PaginacionDto,
    ctx: TenantContext,
  ) {
    await this.obtenerPorId(productoId, ctx);
    const cliente = this.prisma.forTenant(ctx);
    const { pagina, limite, skip, take } = obtenerPaginacion(query);

    const variantes = await cliente.variante.findMany({
      where: { productoId },
      select: { id: true, sku: true, talla: true, color: true, colorHex: true },
    });
    const variantesMap = new Map(variantes.map(v => [v.id, v]));
    const varianteIds = variantes.map(v => v.id);
    if (varianteIds.length === 0) {
      return crearResultadoPaginado([], 0, { pagina, limite });
    }

    const where: Prisma.MovimientoStockWhereInput = {
      varianteId: query.varianteId ? query.varianteId : { in: varianteIds },
    };
    if (query.sucursalId) where.sucursalId = query.sucursalId;

    if (query.fechaIni || query.fechaFin) {
      const creadoEn: Prisma.DateTimeFilter = {};
      if (query.fechaIni) creadoEn.gte = new Date(query.fechaIni);
      if (query.fechaFin) {
        const hasta = new Date(query.fechaFin);
        hasta.setDate(hasta.getDate() + 1);
        creadoEn.lt = hasta;
      }
      where.creadoEn = creadoEn;
    }

    if (query.tipo === 'entradas') {
      where.tipo = { in: ['ingreso_compra', 'ingreso_devolucion', 'ingreso_ajuste', 'traslado_entrada'] };
    } else if (query.tipo === 'salidas') {
      where.tipo = { in: ['egreso_venta', 'egreso_merma', 'egreso_ajuste', 'traslado_salida'] };
    }

    const [movs, total, sucursales] = await Promise.all([
      cliente.movimientoStock.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
      }),
      cliente.movimientoStock.count({ where }),
      cliente.sucursal.findMany({ select: { id: true, nombre: true } }),
    ]);
    const sucursalesMap = new Map(sucursales.map(s => [s.id, s.nombre]));

    // Resolver referencias (compra/venta) en batch para evitar N+1
    const compraIds = movs
      .filter(m => m.referenciaTipo?.toLowerCase() === 'compra' && m.referenciaId)
      .map(m => m.referenciaId!);
    const ventaIds = movs
      .filter(m => m.referenciaTipo?.toLowerCase() === 'venta' && m.referenciaId)
      .map(m => m.referenciaId!);

    const [compras, ventas] = await Promise.all([
      compraIds.length
        ? cliente.compra.findMany({
            where: { id: { in: compraIds } },
            select: {
              id: true,
              numero: true,
              serie: true,
              numeroComprobante: true,
              fechaEmision: true,
              proveedor: { select: { id: true, razonSocial: true } },
            },
          })
        : Promise.resolve([] as any[]),
      ventaIds.length
        ? cliente.venta.findMany({
            where: { id: { in: ventaIds } },
            select: {
              id: true,
              numero: true,
              creadoEn: true,
              cliente: { select: { id: true, nombre: true } },
            },
          })
        : Promise.resolve([] as any[]),
    ]);
    const comprasMap = new Map(compras.map(c => [c.id, c]));
    const ventasMap = new Map(ventas.map(v => [v.id, v]));

    const datos = movs.map(m => {
      const v = variantesMap.get(m.varianteId);
      const esEntrada = m.tipo.startsWith('ingreso') || m.tipo === 'traslado_entrada';
      const refTipo = m.referenciaTipo?.toLowerCase();
      const ref =
        refTipo === 'compra' && m.referenciaId ? comprasMap.get(m.referenciaId) :
        refTipo === 'venta' && m.referenciaId ? ventasMap.get(m.referenciaId) : null;

      return {
        id: m.id,
        fecha: m.creadoEn,
        tipo: m.tipo,
        esEntrada,
        cantidad: m.cantidad,
        stockAntes: m.stockAntes,
        stockDespues: m.stockDespues,
        notas: m.notas,
        sucursal: { id: m.sucursalId, nombre: sucursalesMap.get(m.sucursalId) ?? '—' },
        variante: v
          ? { id: v.id, sku: v.sku, talla: v.talla, color: v.color, colorHex: v.colorHex }
          : null,
        referencia: ref
          ? {
              tipo: refTipo,
              id: m.referenciaId,
              numero:
                refTipo === 'compra'
                  ? `${(ref as any).serie}-${(ref as any).numeroComprobante}`
                  : (ref as any).numero,
              fecha:
                refTipo === 'compra'
                  ? (ref as any).fechaEmision
                  : (ref as any).creadoEn,
              contraparte:
                refTipo === 'compra'
                  ? (ref as any).proveedor?.razonSocial
                  : (ref as any).cliente?.nombre,
            }
          : null,
      };
    });

    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async buscarPorCodigoBarras(codigo: string, ctx: TenantContext) {
    const variante = await this.prisma.forTenant(ctx).variante.findFirst({
      where: {
        codigoBarras: codigo,
        eliminadoEn: null,
        producto: { eliminadoEn: null },
      },
      include: {
        producto: { include: { categoria: true } },
        stocks: true,
      },
    });
    if (!variante) throw new ErrorNoEncontrado(`No se encontró variante con código ${codigo}`);
    return variante;
  }

  // ─── Imágenes ────────────────────────────────────────────────────────────
  // Estructura blob: <tenant>/productos/<productoId>/<timestamp>-<slug>.<ext>

  async subirImagenes(
    productoId: string,
    archivos: Express.Multer.File[],
    ctx: TenantContext,
  ): Promise<string[]> {
    if (!archivos || archivos.length === 0) {
      throw new ErrorValidacion('No se recibieron archivos');
    }
    const producto = await this.obtenerPorId(productoId, ctx);
    const cliente = this.prisma.forTenant(ctx);

    const tiposPermitidos = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const urls: string[] = [];

    for (const archivo of archivos) {
      if (!tiposPermitidos.has(archivo.mimetype)) {
        throw new ErrorValidacion(
          `Tipo no permitido: ${archivo.mimetype}. Solo JPG, PNG, WEBP o GIF.`,
        );
      }
      const ext = (archivo.originalname.split('.').pop() ?? 'jpg').toLowerCase();
      const slug = archivo.originalname
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase()
        .slice(0, 40);
      const ts = Date.now();
      const ruta = `productos/${productoId}/${ts}-${slug}.${ext}`;
      const url = await this.blob.subir(ctx.codigo, ruta, archivo.buffer, archivo.mimetype);
      urls.push(url);
    }

    const imagenesActualizadas = [...(producto.imagenes ?? []), ...urls];
    await cliente.producto.update({
      where: { id: productoId },
      data: { imagenes: imagenesActualizadas },
    });
    return imagenesActualizadas;
  }

  async eliminarImagen(
    productoId: string,
    url: string,
    ctx: TenantContext,
  ): Promise<string[]> {
    if (!url) throw new ErrorValidacion('Falta el parámetro url');
    const producto = await this.obtenerPorId(productoId, ctx);
    const cliente = this.prisma.forTenant(ctx);

    if (!producto.imagenes?.includes(url)) {
      throw new ErrorNoEncontrado('Esa imagen no pertenece al producto');
    }

    // Derivar la ruta relativa al tenant desde la URL pública.
    // URL: https://<account>.blob.core.windows.net/<container>/<tenant>/<ruta>
    const partes = url.split(`/${ctx.codigo}/`);
    if (partes.length >= 2) {
      const rutaRelativa = partes[1]!;
      await this.blob.eliminar(ctx.codigo, rutaRelativa);
    }

    const imagenesActualizadas = producto.imagenes.filter(i => i !== url);
    await cliente.producto.update({
      where: { id: productoId },
      data: { imagenes: imagenesActualizadas },
    });
    return imagenesActualizadas;
  }
}
