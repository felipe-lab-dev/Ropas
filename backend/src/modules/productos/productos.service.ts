import { Injectable } from '@nestjs/common';
import { Prisma, Genero, Temporada } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';
import {
  construirBusquedaWordSplit,
  obtenerPaginacion,
  PaginacionDto,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaTenantService) {}

  async listar(query: PaginacionDto & { categoriaId?: string; activo?: string }, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.ProductoWhereInput = { eliminadoEn: null };

    if (query.categoriaId) where.categoriaId = query.categoriaId;
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
          categoria: { select: { id: true, nombre: true } },
          marca: { select: { id: true, nombre: true } },
          variantes: {
            where: { eliminadoEn: null },
            select: {
              id: true,
              talla: true,
              color: true,
              colorHex: true,
              codigoBarras: true,
              stocks: { select: { disponible: true } },
            },
          },
        },
      }),
      cliente.producto.count({ where }),
    ]);

    const conTotales = datos.map(p => ({
      ...p,
      stockTotal: p.variantes.reduce(
        (acc, v) => acc + v.stocks.reduce((s, st) => s + st.disponible, 0),
        0,
      ),
      cantidadVariantes: p.variantes.length,
    }));

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
        },
      },
    });
    if (!producto) throw new ErrorNoEncontrado('Producto no encontrado');
    return producto;
  }

  async crear(dto: CrearProductoDto, ctx: TenantContext) {
    if (!dto.variantes || dto.variantes.length === 0) {
      throw new ErrorValidacion('Debe incluir al menos una variante');
    }
    const cliente = this.prisma.forTenant(ctx);

    const sku = dto.sku?.trim() || (await this.siguienteSkuAuto(ctx));

    const skuExiste = await cliente.producto.findFirst({
      where: { sku, eliminadoEn: null },
    });
    if (skuExiste) throw new ErrorConflicto(`SKU "${sku}" ya existe`);

    if (dto.codigo) {
      const codigoExiste = await cliente.producto.findFirst({
        where: { codigo: dto.codigo, eliminadoEn: null },
      });
      if (codigoExiste) throw new ErrorConflicto(`Código "${dto.codigo}" ya existe`);
    }

    return cliente.$transaction(async tx => {
      const producto = await tx.producto.create({
        data: {
          sku,
          codigo: dto.codigo?.trim() || null,
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          categoriaId: dto.categoriaId,
          marcaId: dto.marcaId,
          genero: (dto.genero ?? 'unisex') as Genero,
          temporada: (dto.temporada ?? 'todo_el_anio') as Temporada,
          material: dto.material,
          cuidado: dto.cuidado,
          precioVenta: dto.precioVenta,
          precioCompra: dto.precioCompra,
          imagenes: dto.imagenes ?? [],
          tags: dto.tags ?? [],
        },
      });

      for (const [i, v] of dto.variantes.entries()) {
        await tx.variante.create({
          data: {
            productoId: producto.id,
            sku: v.sku ?? `${sku}-${String(i + 1).padStart(2, '0')}`,
            talla: v.talla,
            color: v.color,
            colorHex: v.colorHex,
            codigoBarras: v.codigoBarras,
            precioVenta: v.precioVenta,
            pesoGramos: v.pesoGramos,
          },
        });
      }
      return tx.producto.findFirstOrThrow({
        where: { id: producto.id },
        include: { variantes: true, categoria: true, marca: true },
      });
    });
  }

  /**
   * Genera siguiente SKU correlativo del tipo "P-00001" único por tenant.
   * Lee el último SKU con prefijo "P-" y suma 1.
   */
  private async siguienteSkuAuto(ctx: TenantContext): Promise<string> {
    const cliente = this.prisma.forTenant(ctx);
    const ultimo = await cliente.producto.findFirst({
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
    await this.obtenerPorId(id, ctx);
    return this.prisma.forTenant(ctx).producto.update({
      where: { id },
      data: {
        codigo: dto.codigo,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        categoriaId: dto.categoriaId,
        marcaId: dto.marcaId,
        genero: dto.genero as Genero | undefined,
        temporada: dto.temporada as Temporada | undefined,
        material: dto.material,
        cuidado: dto.cuidado,
        precioVenta: dto.precioVenta,
        precioCompra: dto.precioCompra,
        imagenes: dto.imagenes,
        tags: dto.tags,
        activo: dto.activo,
      },
      include: { variantes: true },
    });
  }

  async eliminar(id: string, ctx: TenantContext) {
    await this.obtenerPorId(id, ctx);
    await this.prisma.forTenant(ctx).producto.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
  }

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
      where: { productoId, eliminadoEn: null },
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
      where.creadoEn = {};
      if (query.fechaIni) (where.creadoEn as any).gte = new Date(query.fechaIni);
      if (query.fechaFin) {
        const hasta = new Date(query.fechaFin);
        hasta.setDate(hasta.getDate() + 1);
        (where.creadoEn as any).lt = hasta;
      }
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
      .filter(m => m.referenciaTipo === 'compra' && m.referenciaId)
      .map(m => m.referenciaId!) ;
    const ventaIds = movs
      .filter(m => m.referenciaTipo === 'venta' && m.referenciaId)
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
      const ref =
        m.referenciaTipo === 'compra' && m.referenciaId ? comprasMap.get(m.referenciaId) :
        m.referenciaTipo === 'venta' && m.referenciaId ? ventasMap.get(m.referenciaId) : null;

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
              tipo: m.referenciaTipo,
              id: m.referenciaId,
              numero:
                m.referenciaTipo === 'compra'
                  ? `${(ref as any).serie}-${(ref as any).numeroComprobante}`
                  : (ref as any).numero,
              fecha:
                m.referenciaTipo === 'compra'
                  ? (ref as any).fechaEmision
                  : (ref as any).creadoEn,
              contraparte:
                m.referenciaTipo === 'compra'
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
      where: { codigoBarras: codigo, eliminadoEn: null },
      include: {
        producto: { include: { categoria: true } },
        stocks: true,
      },
    });
    if (!variante) throw new ErrorNoEncontrado(`No se encontró variante con código ${codigo}`);
    return variante;
  }
}
