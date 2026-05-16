---
applyTo: "backend/**/*.ts"
---

# Backend — convenciones obligatorias

## Estructura de un módulo NestJS

```
backend/src/modules/<dominio>/
├── dto/
│   ├── crear-<dominio>.dto.ts          # Zod schema + tipo derivado
│   └── actualizar-<dominio>.dto.ts
├── <dominio>.controller.ts             # HTTP thin layer
├── <dominio>.service.ts                # Lógica de negocio
├── <dominio>.repository.ts             # Acceso a Prisma (opcional, si la query es compleja)
├── <dominio>.module.ts                 # NestJS module
└── <dominio>.permissions.ts            # Constantes de permisos del módulo
```

## Capas — qué va dónde

| Capa | Responsabilidad | NUNCA hace |
|------|-----------------|------------|
| Controller | Extraer datos del request, llamar service, devolver respuesta estándar | Lógica de negocio, queries directas |
| Service | Orquestar lógica de negocio, transacciones, validaciones de dominio | HTTP, parsing de query params |
| Repository (opc.) | Encapsular queries Prisma complejas | Lógica de negocio |
| DTO | Validar input con Zod | Tener métodos |
| Permissions | Constantes con permisos del módulo | Lógica |

## Patrón de service típico

```ts
@Injectable()
export class ProductoService {
  constructor(
    private readonly prisma: PrismaTenantService,
    private readonly logger: Logger,
  ) {}

  async listar(query: ListarProductosDto, ctx: TenantContext) {
    const { pagina, limite } = obtenerPaginacion(query);
    const where: Prisma.ProductoWhereInput = { eliminadoEn: null };

    if (query.buscar) {
      const palabras = query.buscar.trim().split(/\s+/).filter(Boolean);
      where.AND = palabras.map(palabra => ({
        OR: [
          { nombre: { contains: palabra, mode: 'insensitive' } },
          { sku: { contains: palabra, mode: 'insensitive' } },
        ],
      }));
    }

    const [datos, total] = await Promise.all([
      this.prisma.forTenant(ctx).producto.findMany({
        where, skip: (pagina - 1) * limite, take: limite,
        orderBy: { creadoEn: 'desc' },
      }),
      this.prisma.forTenant(ctx).producto.count({ where }),
    ]);

    return crearResultadoPaginado(datos, total, { pagina, limite });
  }

  async obtenerPorId(id: string, ctx: TenantContext) {
    const producto = await this.prisma.forTenant(ctx).producto.findFirst({
      where: { id, eliminadoEn: null },
      include: { variantes: true },
    });
    if (!producto) throw new ErrorNoEncontrado('Producto no encontrado');
    return producto;
  }
}
```

## Controller delgado

```ts
@Controller('productos')
@UseGuards(AuthGuard, ModuloHabilitadoGuard)
@ModuloHabilitado('productos')
export class ProductoController {
  constructor(private readonly service: ProductoService) {}

  @Get()
  @RequierePermiso('productos:leer')
  async listar(@Query() query: ListarProductosDto, @Tenant() ctx: TenantContext) {
    return this.service.listar(query, ctx);
  }

  @Post()
  @RequierePermiso('productos:crear')
  async crear(@Body() dto: CrearProductoDto, @Tenant() ctx: TenantContext) {
    const producto = await this.service.crear(dto, ctx);
    return respuestaExito(producto, 'Producto creado correctamente');
  }
}
```

## DTO con Zod

```ts
import { z } from 'zod';

export const CrearProductoSchema = z.object({
  nombre: z.string().min(1).max(120),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  precioVenta: z.number().positive(),
  categoriaId: z.string().uuid(),
  variantes: z.array(z.object({
    talla: z.string(),
    color: z.string(),
    stockInicial: z.number().int().min(0),
  })).min(1),
});

export type CrearProductoDto = z.infer<typeof CrearProductoSchema>;
```

Validación se enchufa con `ZodValidationPipe` global.

## Errores

```ts
// core/errors/index.ts
export class ErrorAplicacion extends Error {
  constructor(public readonly codigo: number, mensaje: string) { super(mensaje); }
}
export class ErrorNoEncontrado extends ErrorAplicacion { constructor(m: string){ super(404, m); } }
export class ErrorValidacion extends ErrorAplicacion { constructor(m: string, public errores?: any[]){ super(400, m); } }
export class ErrorNoAutorizado extends ErrorAplicacion { constructor(m='No autenticado'){ super(401, m); } }
export class ErrorProhibido extends ErrorAplicacion { constructor(m='Sin permiso'){ super(403, m); } }
export class ErrorConflicto extends ErrorAplicacion { constructor(m: string){ super(409, m); } }
```

Filter global `AppExceptionFilter` traduce a respuesta estándar.

## Transacciones

Cualquier operación que modifique 2+ tablas relacionadas DEBE ir en `prisma.$transaction`:

```ts
await this.prisma.forTenant(ctx).$transaction(async tx => {
  const venta = await tx.venta.create({ data: ... });
  await tx.movimientoStock.createMany({ data: ... });
  await tx.movimientoCaja.create({ data: ... });
  return venta;
});
```

## Logging

```ts
// Inyectar Logger de Nest. Pino debajo.
this.logger.log({ ventaId: venta.id, monto: venta.total }, 'Venta creada');
this.logger.error({ err, productoId }, 'Error al crear producto');
```

Nunca `console.log`. Nunca loguear contraseñas, tokens, ni headers `Authorization`.

## Multi-tenancy

`PrismaTenantService.forTenant(ctx)` retorna un `PrismaClient` con `search_path` apuntando al schema del tenant. **Nunca** usar `prisma` "raw" desde un service de módulo de negocio — solo desde `core/saas/` y `core/tenancy/`.
