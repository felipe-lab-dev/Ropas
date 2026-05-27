import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import {
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../core/errors/errores';
import {
  obtenerPaginacion,
  PaginacionDto,
  construirBusquedaWordSplit,
} from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';
import { CrearCuponDto } from './dto/crear-cupon.dto';
import { ActualizarCuponDto } from './dto/actualizar-cupon.dto';
import { AplicarPlantillaDto } from './dto/aplicar-plantilla.dto';
import { ValidarCuponDto } from './dto/validar-cupon.dto';
import { MotorCuponesService, ItemCarrito } from './motor-cupones.service';
import { PLANTILLAS_CUPONES, generarCodigoCupon } from './plantillas-cupones';

interface ListarCuponesQuery extends PaginacionDto {
  estado?: string;
  segmento?: string;
  vigentes?: string;
  campania?: string;
}

@Injectable()
export class CuponesService {
  constructor(
    private readonly prisma: PrismaTenantService,
    private readonly motor: MotorCuponesService,
  ) {}

  // ─── LISTAR / OBTENER ────────────────────────────────────────────────

  async listar(query: ListarCuponesQuery, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const where: Prisma.CuponWhereInput = { eliminadoEn: null };

    if (query.estado) where.estado = query.estado as never;
    if (query.segmento) where.segmento = query.segmento as never;
    if (query.campania) where.campania = query.campania;
    if (query.vigentes === 'true') {
      const ahora = new Date();
      where.fechaInicio = { lte: ahora };
      where.fechaFin = { gte: ahora };
      where.estado = 'activo';
    }

    const busqueda = construirBusquedaWordSplit(query.buscar, [
      'codigo',
      'nombre',
      'descripcion',
      'campania',
    ]);
    if (busqueda) Object.assign(where, busqueda);

    const cliente = this.prisma.forTenant(ctx);
    const [datos, total] = await Promise.all([
      cliente.cupon.findMany({
        where,
        skip,
        take,
        orderBy: { creadoEn: 'desc' },
        include: { _count: { select: { usos: true } } },
      }),
      cliente.cupon.count({ where }),
    ]);
    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async obtener(id: string, ctx: TenantContext) {
    const c = await this.prisma.forTenant(ctx).cupon.findFirst({
      where: { id, eliminadoEn: null },
      include: {
        _count: { select: { usos: true } },
        creadoPor: { select: { id: true, nombre: true } },
      },
    });
    if (!c) throw new ErrorNoEncontrado('Cupón no encontrado');
    return c;
  }

  async obtenerPorCodigo(codigo: string, ctx: TenantContext) {
    const c = await this.prisma.forTenant(ctx).cupon.findFirst({
      where: { codigo: codigo.toUpperCase(), eliminadoEn: null },
      include: { _count: { select: { usos: true } } },
    });
    if (!c) throw new ErrorNoEncontrado(`Cupón "${codigo}" no encontrado`);
    return c;
  }

  // ─── CREAR ───────────────────────────────────────────────────────────

  async crear(dto: CrearCuponDto, ctx: TenantContext, creadoPorId?: string) {
    this.validarRangoFechas(dto.fechaInicio, dto.fechaFin);
    this.validarPorcentaje(dto.tipoDescuento, dto.valorDescuento);
    this.validarConsistenciaAplicacion(dto.aplicableA, dto.categoriasAplicablesIds, dto.productosAplicablesIds);
    this.validarConsistenciaSegmento(dto.segmento, dto.clientesElegiblesIds);

    const cliente = this.prisma.forTenant(ctx);

    const yaExiste = await cliente.cupon.findFirst({
      where: { codigo: dto.codigo, eliminadoEn: null },
    });
    if (yaExiste) throw new ErrorConflicto(`Ya existe un cupón con código "${dto.codigo}"`);

    return cliente.cupon.create({
      data: {
        codigo: dto.codigo,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        tipoDescuento: dto.tipoDescuento,
        valorDescuento: new Prisma.Decimal(dto.valorDescuento),
        montoMinimoCompra:
          dto.montoMinimoCompra != null ? new Prisma.Decimal(dto.montoMinimoCompra) : null,
        descuentoMaximo:
          dto.descuentoMaximo != null ? new Prisma.Decimal(dto.descuentoMaximo) : null,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        usosMaximosTotal: dto.usosMaximosTotal ?? null,
        usosMaximosPorCliente: dto.usosMaximosPorCliente ?? 1,
        segmento: (dto.segmento ?? 'todos') as never,
        clientesElegiblesIds: dto.clientesElegiblesIds ?? [],
        aplicableA: (dto.aplicableA ?? 'toda_compra') as never,
        categoriasAplicablesIds: dto.categoriasAplicablesIds ?? [],
        productosAplicablesIds: dto.productosAplicablesIds ?? [],
        campania: dto.campania ?? null,
        plantilla: dto.plantilla ?? null,
        disenoColorPrimario: dto.disenoColorPrimario ?? '#7c3aed',
        disenoColorSecundario: dto.disenoColorSecundario ?? '#1e1b4b',
        disenoMensaje: dto.disenoMensaje ?? null,
        disenoEmoji: dto.disenoEmoji ?? null,
        creadoPorId: creadoPorId ?? null,
      },
    });
  }

  async crearDesdePlantilla(dto: AplicarPlantillaDto, ctx: TenantContext, creadoPorId?: string) {
    const plantilla = PLANTILLAS_CUPONES[dto.plantilla];
    if (!plantilla) throw new ErrorValidacion(`Plantilla "${dto.plantilla}" no existe`);

    const inicio = dto.fechaInicio ? new Date(dto.fechaInicio) : new Date();
    const fin = dto.fechaFin
      ? new Date(dto.fechaFin)
      : new Date(inicio.getTime() + plantilla.diasVigenciaSugeridos * 86400_000);

    const codigo = dto.codigo ?? generarCodigoCupon(plantilla.id.slice(0, 6).toUpperCase());

    return this.crear(
      {
        codigo,
        nombre: plantilla.config.nombre,
        descripcion: plantilla.config.descripcion,
        tipoDescuento: plantilla.config.tipoDescuento,
        valorDescuento: plantilla.config.valorDescuento,
        montoMinimoCompra: plantilla.config.montoMinimoCompra,
        descuentoMaximo: plantilla.config.descuentoMaximo,
        fechaInicio: inicio.toISOString(),
        fechaFin: fin.toISOString(),
        usosMaximosTotal: plantilla.config.usosMaximosTotal,
        usosMaximosPorCliente: plantilla.config.usosMaximosPorCliente,
        segmento: plantilla.config.segmento,
        aplicableA: plantilla.config.aplicableA,
        campania: plantilla.titulo,
        plantilla: plantilla.id,
        disenoColorPrimario: plantilla.config.disenoColorPrimario,
        disenoColorSecundario: plantilla.config.disenoColorSecundario,
        disenoMensaje: plantilla.config.disenoMensaje,
        disenoEmoji: plantilla.config.disenoEmoji,
      } as CrearCuponDto,
      ctx,
      creadoPorId,
    );
  }

  // ─── ACTUALIZAR / ELIMINAR / PAUSAR ──────────────────────────────────

  async actualizar(id: string, dto: ActualizarCuponDto, ctx: TenantContext) {
    const actual = await this.obtener(id, ctx);
    const cliente = this.prisma.forTenant(ctx);

    const inicio = dto.fechaInicio ? new Date(dto.fechaInicio) : actual.fechaInicio;
    const fin = dto.fechaFin ? new Date(dto.fechaFin) : actual.fechaFin;
    this.validarRangoFechas(inicio.toISOString(), fin.toISOString());

    if (dto.valorDescuento != null) {
      this.validarPorcentaje(actual.tipoDescuento, dto.valorDescuento);
    }
    if (dto.aplicableA != null) {
      this.validarConsistenciaAplicacion(
        dto.aplicableA,
        dto.categoriasAplicablesIds ?? actual.categoriasAplicablesIds,
        dto.productosAplicablesIds ?? actual.productosAplicablesIds,
      );
    }
    if (dto.segmento != null) {
      this.validarConsistenciaSegmento(
        dto.segmento,
        dto.clientesElegiblesIds ?? actual.clientesElegiblesIds,
      );
    }

    const data: Prisma.CuponUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.valorDescuento !== undefined) data.valorDescuento = new Prisma.Decimal(dto.valorDescuento);
    if (dto.montoMinimoCompra !== undefined) {
      data.montoMinimoCompra =
        dto.montoMinimoCompra != null ? new Prisma.Decimal(dto.montoMinimoCompra) : null;
    }
    if (dto.descuentoMaximo !== undefined) {
      data.descuentoMaximo =
        dto.descuentoMaximo != null ? new Prisma.Decimal(dto.descuentoMaximo) : null;
    }
    if (dto.fechaInicio !== undefined) data.fechaInicio = inicio;
    if (dto.fechaFin !== undefined) data.fechaFin = fin;
    if (dto.usosMaximosTotal !== undefined) data.usosMaximosTotal = dto.usosMaximosTotal;
    if (dto.usosMaximosPorCliente !== undefined) data.usosMaximosPorCliente = dto.usosMaximosPorCliente;
    if (dto.segmento !== undefined) data.segmento = dto.segmento as never;
    if (dto.clientesElegiblesIds !== undefined) data.clientesElegiblesIds = dto.clientesElegiblesIds;
    if (dto.aplicableA !== undefined) data.aplicableA = dto.aplicableA as never;
    if (dto.categoriasAplicablesIds !== undefined) data.categoriasAplicablesIds = dto.categoriasAplicablesIds;
    if (dto.productosAplicablesIds !== undefined) data.productosAplicablesIds = dto.productosAplicablesIds;
    if (dto.campania !== undefined) data.campania = dto.campania;
    if (dto.disenoColorPrimario !== undefined) data.disenoColorPrimario = dto.disenoColorPrimario;
    if (dto.disenoColorSecundario !== undefined) data.disenoColorSecundario = dto.disenoColorSecundario;
    if (dto.disenoMensaje !== undefined) data.disenoMensaje = dto.disenoMensaje;
    if (dto.disenoEmoji !== undefined) data.disenoEmoji = dto.disenoEmoji;
    if (dto.pausar === true) {
      data.estado = 'pausado';
      data.pausadoEn = new Date();
    } else if (dto.pausar === false) {
      data.estado = 'activo';
      data.pausadoEn = null;
    } else if (dto.estado !== undefined) {
      data.estado = dto.estado as never;
      if (dto.estado === 'pausado') data.pausadoEn = new Date();
      if (dto.estado === 'activo') data.pausadoEn = null;
    }

    return cliente.cupon.update({ where: { id }, data });
  }

  async eliminar(id: string, ctx: TenantContext) {
    await this.obtener(id, ctx);
    await this.prisma.forTenant(ctx).cupon.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
  }

  // ─── VALIDAR / APLICAR ───────────────────────────────────────────────

  /**
   * Valida un cupón contra un carrito (uso desde frontend para mostrar
   * descuento antes de confirmar venta). No registra uso.
   */
  async validar(dto: ValidarCuponDto, ctx: TenantContext) {
    const cliente = this.prisma.forTenant(ctx);
    const cupon = await cliente.cupon.findFirst({
      where: { codigo: dto.codigo.toUpperCase(), eliminadoEn: null },
    });
    if (!cupon) {
      return {
        valido: false as const,
        descuento: 0,
        baseAplicable: 0,
        itemsAplicables: [],
        mensaje: `El código "${dto.codigo}" no existe`,
      };
    }

    const [usosTotales, usosCliente] = await Promise.all([
      cliente.cuponUso.count({ where: { cuponId: cupon.id } }),
      dto.clienteId
        ? cliente.cuponUso.count({ where: { cuponId: cupon.id, clienteId: dto.clienteId } })
        : Promise.resolve(0),
    ]);

    let clasificacion: 'AA' | 'A' | 'B' | 'C' | 'D' | null = null;
    if (dto.clienteId) {
      const c = await cliente.cliente.findFirst({
        where: { id: dto.clienteId, eliminadoEn: null },
        select: { clasificacion: true, totalCompras: true, ultimaCompraEn: true },
      });
      clasificacion = c?.clasificacion ?? null;
      // Validaciones extras de segmento que dependen del cliente
      if (cupon.segmento === 'nuevos_clientes' && Number(c?.totalCompras ?? 0) > 0) {
        return rechazoValidacion('El cupón es solo para nuevos clientes');
      }
      if (cupon.segmento === 'reactivacion') {
        if (!c?.ultimaCompraEn) return rechazoValidacion('El cliente nunca compró — usa un cupón de bienvenida');
        const dias = (Date.now() - c.ultimaCompraEn.getTime()) / 86400_000;
        if (dias < 60) {
          return rechazoValidacion(`El cliente compró hace ${Math.floor(dias)} días — el cupón es para 60+ días`);
        }
      }
    }

    // Enriquecer items si no traen productoId/categoriaId
    const itemsEnriquecidos: ItemCarrito[] = await Promise.all(
      dto.items.map(async i => {
        if (i.productoId && i.categoriaId) {
          return {
            varianteId: i.varianteId,
            productoId: i.productoId,
            categoriaId: i.categoriaId,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
          };
        }
        const v = await cliente.variante.findUnique({
          where: { id: i.varianteId },
          select: { producto: { select: { id: true, categoriaId: true } } },
        });
        return {
          varianteId: i.varianteId,
          productoId: v?.producto.id ?? '',
          categoriaId: v?.producto.categoriaId ?? '',
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        };
      }),
    );

    return this.motor.evaluar({
      cupon: {
        estado: cupon.estado as never,
        eliminadoEn: cupon.eliminadoEn,
        fechaInicio: cupon.fechaInicio,
        fechaFin: cupon.fechaFin,
        tipoDescuento: cupon.tipoDescuento as never,
        valorDescuento: cupon.valorDescuento,
        montoMinimoCompra: cupon.montoMinimoCompra,
        descuentoMaximo: cupon.descuentoMaximo,
        usosMaximosTotal: cupon.usosMaximosTotal,
        usosMaximosPorCliente: cupon.usosMaximosPorCliente,
        segmento: cupon.segmento,
        clientesElegiblesIds: cupon.clientesElegiblesIds,
        aplicableA: cupon.aplicableA as never,
        categoriasAplicablesIds: cupon.categoriasAplicablesIds,
        productosAplicablesIds: cupon.productosAplicablesIds,
      },
      carrito: itemsEnriquecidos,
      clienteIdSolicitante: dto.clienteId,
      clienteClasificacion: clasificacion,
      usosTotalesActuales: usosTotales,
      usosDelClienteActuales: usosCliente,
    });
  }

  // ─── ESTADÍSTICAS ────────────────────────────────────────────────────

  async estadisticas(id: string, ctx: TenantContext) {
    const cupon = await this.obtener(id, ctx);
    const cliente = this.prisma.forTenant(ctx);
    const [usos, totalDescuento, totalVentas, clientesUnicos] = await Promise.all([
      cliente.cuponUso.count({ where: { cuponId: id } }),
      cliente.cuponUso.aggregate({
        where: { cuponId: id },
        _sum: { montoDescuento: true, montoVenta: true },
      }),
      cliente.cuponUso.aggregate({
        where: { cuponId: id },
        _sum: { montoVenta: true },
      }),
      cliente.cuponUso.groupBy({
        by: ['clienteId'],
        where: { cuponId: id, clienteId: { not: null } },
      }),
    ]);

    const descuentoEntregado = Number(totalDescuento._sum.montoDescuento ?? 0);
    const ventasGeneradas = Number(totalVentas._sum.montoVenta ?? 0);
    const roi = descuentoEntregado > 0
      ? Number(((ventasGeneradas - descuentoEntregado) / descuentoEntregado).toFixed(2))
      : null;

    const tasaCanje = cupon.usosMaximosTotal
      ? Number(((usos / cupon.usosMaximosTotal) * 100).toFixed(1))
      : null;

    return {
      usos,
      descuentoEntregado: descuentoEntregado.toFixed(2),
      ventasGeneradas: ventasGeneradas.toFixed(2),
      ingresoNeto: (ventasGeneradas - descuentoEntregado).toFixed(2),
      roi,
      clientesUnicos: clientesUnicos.length,
      tasaCanje,
    };
  }

  async historial(id: string, ctx: TenantContext) {
    await this.obtener(id, ctx);
    return this.prisma.forTenant(ctx).cuponUso.findMany({
      where: { cuponId: id },
      orderBy: { aplicadoEn: 'desc' },
      take: 100,
      include: {
        cliente: { select: { id: true, nombre: true, documento: true } },
        venta: { select: { id: true, numero: true, total: true } },
      },
    });
  }

  // ─── VALIDACIONES INTERNAS ───────────────────────────────────────────

  private validarRangoFechas(inicio: string, fin: string) {
    const di = new Date(inicio);
    const df = new Date(fin);
    if (isNaN(di.getTime()) || isNaN(df.getTime())) {
      throw new ErrorValidacion('Fechas inválidas');
    }
    if (df <= di) {
      throw new ErrorValidacion('La fecha fin debe ser posterior a la fecha inicio');
    }
  }

  private validarPorcentaje(tipo: string, valor: number) {
    if (tipo === 'porcentaje' && (valor <= 0 || valor > 100)) {
      throw new ErrorValidacion('El porcentaje debe estar entre 1 y 100');
    }
  }

  private validarConsistenciaAplicacion(
    aplicableA: string | undefined,
    categorias: string[] | undefined,
    productos: string[] | undefined,
  ) {
    if (aplicableA === 'categorias' && (!categorias || categorias.length === 0)) {
      throw new ErrorValidacion('Indica al menos una categoría aplicable');
    }
    if (aplicableA === 'productos' && (!productos || productos.length === 0)) {
      throw new ErrorValidacion('Indica al menos un producto aplicable');
    }
  }

  private validarConsistenciaSegmento(segmento: string | undefined, clientes: string[] | undefined) {
    if (segmento === 'lista_clientes' && (!clientes || clientes.length === 0)) {
      throw new ErrorValidacion('Indica al menos un cliente elegible');
    }
  }
}

function rechazoValidacion(mensaje: string) {
  return {
    valido: false as const,
    descuento: 0,
    baseAplicable: 0,
    itemsAplicables: [],
    mensaje,
  };
}
