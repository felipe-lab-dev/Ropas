import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaTenantService } from '../../core/prisma/prisma-tenant.service';
import { TenantContext } from '../../core/tenancy/tenant-context';
import { ErrorValidacion } from '../../core/errors/errores';
import { obtenerPaginacion, PaginacionDto } from '../../core/pagination/paginacion';
import { crearResultadoPaginado } from '../../core/responses/respuesta.interceptor';
import { unidadMedidaExiste } from '../../core/sunat/unidades-medida';

const CABECERAS = [
  'sku',
  'codigo',
  'nombre',
  'categoria',
  'marca',
  'precioVenta',
  'precioCompra',
  'unidadMedida',
  'descripcion',
] as const;

type FilaCsv = Partial<Record<(typeof CABECERAS)[number], string>>;

export interface ErrorFilaImportacion {
  fila: number;
  sku?: string;
  nombre?: string;
  error: string;
}

export interface ResultadoImportacion {
  totalFilas: number;
  exitosas: number;
  fallidas: number;
  creados: number;
  actualizados: number;
  errores: ErrorFilaImportacion[];
}

@Injectable()
export class ImportacionProductosService {
  constructor(private readonly prisma: PrismaTenantService) {}

  // ─── Plantilla ─────────────────────────────────────────────────────────

  plantillaCsv(): string {
    const ejemplos = [
      ['POL-001', 'M-0001', 'Polo Básico Rojo', 'Polos', 'Marca Demo', '27.00', '12.50', 'NIU', 'Polo básico 100% algodón'],
      ['', '', 'Blusa Casual', 'Camisas', '', '42.00', '', 'NIU', ''],
    ];
    const lineas = [CABECERAS.join(','), ...ejemplos.map(f => f.map(escaparCampoCsv).join(','))];
    // BOM para que Excel detecte UTF-8 correctamente
    return '﻿' + lineas.join('\r\n') + '\r\n';
  }

  // ─── Importación ───────────────────────────────────────────────────────

  async importar(
    archivo: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    ctx: TenantContext,
    usuarioId?: string,
  ): Promise<ResultadoImportacion> {
    if (!archivo || !archivo.buffer) {
      throw new ErrorValidacion('Falta el archivo a importar');
    }
    const nombreLower = (archivo.originalname || '').toLowerCase();
    if (!nombreLower.endsWith('.csv') && !archivo.mimetype.includes('csv') && !archivo.mimetype.includes('text/plain')) {
      throw new ErrorValidacion('Solo se acepta archivo .csv (UTF-8). Convertí tu Excel a CSV antes de importar.');
    }

    const texto = decodificarUtf8(archivo.buffer);
    const filas = parsearCsv(texto);
    if (filas.length === 0) {
      throw new ErrorValidacion('El archivo está vacío o no se pudo parsear');
    }

    // Header → mapeo
    const header = filas[0]!.map(h => h.trim());
    const indices: Partial<Record<(typeof CABECERAS)[number], number>> = {};
    for (const col of CABECERAS) {
      const i = header.findIndex(h => h.toLowerCase() === col.toLowerCase());
      if (i !== -1) indices[col] = i;
    }
    if (indices.nombre === undefined) {
      throw new ErrorValidacion('La columna "nombre" es obligatoria en la cabecera del CSV');
    }
    if (indices.categoria === undefined) {
      throw new ErrorValidacion('La columna "categoria" es obligatoria en la cabecera del CSV');
    }

    const cliente = this.prisma.forTenant(ctx);

    // Pre-cargar maps de categoría y marca por nombre (lowercase) para validar rápido.
    const [categorias, marcas, sucursalPrincipal] = await Promise.all([
      cliente.categoria.findMany({ where: { eliminadoEn: null }, select: { id: true, nombre: true } }),
      cliente.marca.findMany({ where: { eliminadoEn: null }, select: { id: true, nombre: true } }),
      cliente.sucursal.findFirst({
        where: { eliminadoEn: null, activa: true, esPrincipal: true },
        select: { id: true },
      }),
    ]);
    const sucursalDefault: { id: string } | null =
      sucursalPrincipal ??
      (await cliente.sucursal.findFirst({
        where: { eliminadoEn: null, activa: true },
        select: { id: true },
      }));
    const categoriasMap = new Map(categorias.map(c => [c.nombre.toLowerCase(), c.id]));
    const marcasMap = new Map(marcas.map(m => [m.nombre.toLowerCase(), m.id]));

    const resultado: ResultadoImportacion = {
      totalFilas: 0,
      exitosas: 0,
      fallidas: 0,
      creados: 0,
      actualizados: 0,
      errores: [],
    };

    const filasDatos = filas.slice(1);
    for (let i = 0; i < filasDatos.length; i++) {
      const numFila = i + 2; // CSV humana: header = 1, primer dato = 2
      const fila = filasDatos[i]!;
      if (fila.length === 0 || fila.every(c => !c || c.trim() === '')) continue;
      resultado.totalFilas++;

      const obj: FilaCsv = {};
      for (const col of CABECERAS) {
        const idx = indices[col];
        if (idx !== undefined) obj[col] = (fila[idx] ?? '').trim();
      }

      try {
        await this.procesarFila(obj, numFila, categoriasMap, marcasMap, sucursalDefault, cliente, resultado);
        resultado.exitosas++;
      } catch (e) {
        resultado.fallidas++;
        resultado.errores.push({
          fila: numFila,
          sku: obj.sku || undefined,
          nombre: obj.nombre || undefined,
          error: e instanceof Error ? e.message : 'Error desconocido',
        });
      }
    }

    // Registrar en AuditLog
    await cliente.auditLog.create({
      data: {
        modulo: 'productos',
        accion: 'importacion-csv',
        usuarioId: usuarioId ?? null,
        cambios: {
          archivo: archivo.originalname,
          totalFilas: resultado.totalFilas,
          exitosas: resultado.exitosas,
          fallidas: resultado.fallidas,
          creados: resultado.creados,
          actualizados: resultado.actualizados,
          errores: resultado.errores.slice(0, 50),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return resultado;
  }

  private async procesarFila(
    obj: FilaCsv,
    numFila: number,
    categoriasMap: Map<string, string>,
    marcasMap: Map<string, string>,
    sucursalDefault: { id: string } | null,
    cliente: ReturnType<PrismaTenantService['forTenant']>,
    resultado: ResultadoImportacion,
  ): Promise<void> {
    void numFila;
    const nombre = obj.nombre?.trim();
    if (!nombre) throw new Error('Falta nombre');

    const categoriaNombre = obj.categoria?.trim();
    if (!categoriaNombre) throw new Error('Falta categoria');
    const categoriaId = categoriasMap.get(categoriaNombre.toLowerCase());
    if (!categoriaId) throw new Error(`Categoría "${categoriaNombre}" no existe en el sistema`);

    let marcaId: string | undefined;
    if (obj.marca?.trim()) {
      marcaId = marcasMap.get(obj.marca.trim().toLowerCase());
      if (!marcaId) throw new Error(`Marca "${obj.marca}" no existe en el sistema`);
    }

    const precioVenta = parseDecimal(obj.precioVenta, 'precioVenta');
    if (precioVenta === null) throw new Error('precioVenta es obligatorio');
    if (precioVenta < 0) throw new Error('precioVenta no puede ser negativo');

    const precioCompra = parseDecimal(obj.precioCompra, 'precioCompra');
    if (precioCompra !== null && precioCompra < 0) throw new Error('precioCompra no puede ser negativo');

    const unidad = obj.unidadMedida?.trim() || 'NIU';
    if (!unidadMedidaExiste(unidad)) throw new Error(`Unidad de medida "${unidad}" no es SUNAT válida`);

    const skuLimpio = obj.sku?.trim() || null;
    const codigoLimpio = obj.codigo?.trim() || null;

    // Buscar producto existente por SKU si viene
    const existente = skuLimpio
      ? await cliente.producto.findFirst({ where: { sku: skuLimpio, eliminadoEn: null }, select: { id: true } })
      : null;

    if (existente) {
      await cliente.producto.update({
        where: { id: existente.id },
        data: {
          nombre,
          categoriaId,
          marcaId: marcaId ?? null,
          precioVenta: new Prisma.Decimal(precioVenta),
          precioCompra: precioCompra !== null ? new Prisma.Decimal(precioCompra) : null,
          unidadMedidaCodigo: unidad,
          descripcion: obj.descripcion?.trim() || null,
          codigo: codigoLimpio ?? undefined,
        },
      });
      resultado.actualizados++;
      return;
    }

    // Crear nuevo producto con variante "única" por defecto
    const sku = skuLimpio || await generarSkuAuto(cliente, nombre);
    const codigo = codigoLimpio || await generarCodigoAuto(cliente);

    await cliente.producto.create({
      data: {
        sku,
        codigo,
        nombre,
        categoriaId,
        marcaId: marcaId ?? null,
        precioVenta: new Prisma.Decimal(precioVenta),
        precioCompra: precioCompra !== null ? new Prisma.Decimal(precioCompra) : null,
        unidadMedidaCodigo: unidad,
        descripcion: obj.descripcion?.trim() || null,
        variantes: {
          create: {
            sku: `${sku}-U`,
            talla: 'Única',
            color: 'N/A',
            ...(sucursalDefault ? { stocks: { create: { sucursalId: sucursalDefault.id, disponible: 0, reservado: 0 } } } : {}),
          },
        },
      },
    });
    resultado.creados++;
  }

  // ─── Exportación ───────────────────────────────────────────────────────

  async exportarCsv(ctx: TenantContext): Promise<string> {
    const cliente = this.prisma.forTenant(ctx);
    const productos = await cliente.producto.findMany({
      where: { eliminadoEn: null },
      include: {
        categoria: { select: { nombre: true } },
        marca: { select: { nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    });
    const lineas = [CABECERAS.join(',')];
    for (const p of productos) {
      lineas.push([
        p.sku,
        p.codigo ?? '',
        p.nombre,
        p.categoria.nombre,
        p.marca?.nombre ?? '',
        Number(p.precioVenta).toFixed(2),
        p.precioCompra ? Number(p.precioCompra).toFixed(2) : '',
        p.unidadMedidaCodigo ?? 'NIU',
        p.descripcion ?? '',
      ].map(escaparCampoCsv).join(','));
    }
    return '﻿' + lineas.join('\r\n') + '\r\n';
  }

  // ─── Historial ─────────────────────────────────────────────────────────

  async historial(query: PaginacionDto, ctx: TenantContext) {
    const { pagina, limite, skip, take } = obtenerPaginacion(query);
    const cliente = this.prisma.forTenant(ctx);
    const where: Prisma.AuditLogWhereInput = {
      modulo: 'productos',
      accion: 'importacion-csv',
    };
    const [logs, total] = await Promise.all([
      cliente.auditLog.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        skip,
        take,
      }),
      cliente.auditLog.count({ where }),
    ]);

    const usuarioIds = [...new Set(logs.map(l => l.usuarioId).filter((x): x is string => !!x))];
    const usuarios = usuarioIds.length
      ? await cliente.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, nombre: true, email: true },
        })
      : [];
    const usuariosMap = new Map(usuarios.map(u => [u.id, u]));

    const datos = logs.map(l => {
      const c = (l.cambios ?? {}) as Prisma.JsonObject;
      return {
        id: Number(l.id),
        creadoEn: l.creadoEn,
        usuario: l.usuarioId ? usuariosMap.get(l.usuarioId) ?? null : null,
        archivo: (c['archivo'] as string) ?? '',
        totalFilas: (c['totalFilas'] as number) ?? 0,
        exitosas: (c['exitosas'] as number) ?? 0,
        fallidas: (c['fallidas'] as number) ?? 0,
        creados: (c['creados'] as number) ?? 0,
        actualizados: (c['actualizados'] as number) ?? 0,
      };
    });

    return crearResultadoPaginado(datos, total, { pagina, limite });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function decodificarUtf8(buf: Buffer): string {
  let txt = buf.toString('utf8');
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
  return txt;
}

/**
 * Parser CSV simple. Acepta `,` o `;` como separador (detecta por la primera línea).
 * Soporta campos entre comillas dobles, con "" como escape de comilla.
 */
function parsearCsv(texto: string): string[][] {
  const lineaSinComillas = texto.split(/\r?\n/, 1)[0] ?? '';
  const sep = lineaSinComillas.split(';').length > lineaSinComillas.split(',').length ? ';' : ',';

  const filas: string[][] = [];
  let actual: string[] = [];
  let buffer = '';
  let dentroComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (dentroComillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { buffer += '"'; i++; }
        else { dentroComillas = false; }
      } else {
        buffer += ch;
      }
    } else {
      if (ch === '"') { dentroComillas = true; }
      else if (ch === sep) { actual.push(buffer); buffer = ''; }
      else if (ch === '\n') {
        actual.push(buffer); buffer = '';
        filas.push(actual); actual = [];
      } else if (ch === '\r') {
        // Ignorar: \r\n se cierra con \n
      } else {
        buffer += ch;
      }
    }
  }
  if (buffer.length > 0 || actual.length > 0) {
    actual.push(buffer);
    filas.push(actual);
  }
  return filas;
}

function escaparCampoCsv(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes(';')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseDecimal(v: string | undefined, _campo: string): number | null {
  if (v === undefined || v === null) return null;
  const s = v.toString().trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) throw new Error(`${_campo} no es número válido: "${v}"`);
  return n;
}

async function generarSkuAuto(
  cliente: ReturnType<PrismaTenantService['forTenant']>,
  nombre: string,
): Promise<string> {
  // SKU basado en nombre + timestamp corto para evitar colisiones.
  const base = nombre.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PROD';
  for (let intento = 0; intento < 5; intento++) {
    const suf = Math.floor(Math.random() * 9000 + 1000).toString();
    const candidato = `${base}-${suf}`;
    const existe = await cliente.producto.findFirst({ where: { sku: candidato }, select: { id: true } });
    if (!existe) return candidato;
  }
  return `${base}-${Date.now().toString().slice(-6)}`;
}

async function generarCodigoAuto(
  cliente: ReturnType<PrismaTenantService['forTenant']>,
): Promise<string> {
  const ultimo = await cliente.producto.findFirst({
    where: { codigo: { startsWith: 'M-' } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });
  let n = 1;
  if (ultimo?.codigo) {
    const match = ultimo.codigo.match(/^M-(\d+)$/);
    if (match) n = Number(match[1]) + 1;
  }
  return `M-${String(n).padStart(4, '0')}`;
}
