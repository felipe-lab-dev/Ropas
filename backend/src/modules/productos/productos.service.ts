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

    const skuExiste = await cliente.producto.findFirst({
      where: { sku: dto.sku, eliminadoEn: null },
    });
    if (skuExiste) throw new ErrorConflicto(`SKU "${dto.sku}" ya existe`);

    return cliente.$transaction(async tx => {
      const producto = await tx.producto.create({
        data: {
          sku: dto.sku,
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
            sku: v.sku ?? `${dto.sku}-${i + 1}`,
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

  async actualizar(id: string, dto: ActualizarProductoDto, ctx: TenantContext) {
    await this.obtenerPorId(id, ctx);
    return this.prisma.forTenant(ctx).producto.update({
      where: { id },
      data: {
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
