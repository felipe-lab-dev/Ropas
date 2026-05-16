# Design System — Ropas

> Filosofía: **brutal premium** — alto contraste, tipografía dominante, acentos de color saturados, microinteracciones, dark mode primero.

## Paleta

Definida en `frontend/styles/tokens.css` como variables HSL.

| Token | Light (HSL) | Dark (HSL) | Uso |
|-------|-------------|------------|-----|
| `--brand-primary` | `280 95% 55%` | `280 90% 65%` | CTAs, links, foco |
| `--brand-accent` | `70 95% 60%` | `70 90% 60%` | Highlights, badges premium |
| `--brand-success` | `150 70% 45%` | `150 60% 55%` | Confirmaciones |
| `--brand-danger` | `355 85% 60%` | `355 80% 65%` | Errores, destructivos |
| `--brand-warning` | `35 95% 55%` | `35 85% 60%` | Advertencias |
| `--bg` | `0 0% 100%` | `240 10% 3.9%` | Fondo principal |
| `--surface` | `220 14% 96%` | `240 5.9% 10%` | Cards, sidebar |
| `--surface-2` | `220 13% 91%` | `240 4.8% 16%` | Hover, elevación |
| `--border` | `220 13% 86%` | `240 3.7% 22%` | Bordes |
| `--text` | `220 13% 15%` | `0 0% 98%` | Texto principal |
| `--text-muted` | `220 9% 46%` | `240 5% 65%` | Secundario |

Acceso desde Tailwind: `bg-brand-primary`, `text-brand-accent`, `bg-surface-2`, etc.

## Tipografía

- **Display**: Geist (default) o Space Grotesk (alternativa configurable)
- **Sans**: Geist (UI principal)
- **Mono**: Geist Mono (códigos, SKUs, números en tablas si se activa modo monoespaciado)

Tamaño base configurable de 12 a 18px desde `Configuración → Apariencia`. Aplica vía `document.documentElement.style.fontSize` y persiste en localStorage.

Escala (rem-based, parte de `--base-font-size`):
- `text-xs` 0.75rem
- `text-sm` 0.875rem
- `text-base` 1rem
- `text-lg` 1.125rem
- `text-xl` 1.25rem
- `text-2xl` 1.5rem
- `text-3xl` 1.875rem
- `text-display` 2.5rem (titulares hero)

## Espaciado y radio

- Spacing: escala Tailwind default (4px base).
- Radio: `--radius-sm 6px` (inputs), `--radius-md 10px` (cards), `--radius-lg 16px` (modales), `--radius-xl 24px` (hero blocks).

## Sombras

```css
--shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.04);
--shadow-md: 0 4px 12px hsl(0 0% 0% / 0.08);
--shadow-lg: 0 12px 32px hsl(0 0% 0% / 0.12);
--shadow-glow: 0 0 24px hsl(var(--brand-primary) / 0.4);   /* premium accent */
```

## Componentes base (shadcn/ui)

Instalados con `npx shadcn add <componente>`:

- `button`, `input`, `label`, `select`, `textarea`, `checkbox`, `switch`, `slider`
- `card`, `dialog`, `alert-dialog`, `sheet`, `drawer`
- `dropdown-menu`, `context-menu`, `command`, `popover`, `tooltip`
- `tabs`, `accordion`, `collapsible`
- `table` (wrap con TanStack Table)
- `badge`, `skeleton`, `separator`, `avatar`
- `sonner` (toasts), `progress`

## Patrones de UI brutales

### Hero numbers en dashboard
Números grandes (text-display, font-bold), sufijo en mono pequeño, microbarra de tendencia abajo. Fondo en gradient sutil del color de la métrica.

### Glass cards
`bg-surface/70 backdrop-blur-xl border border-white/10` para elementos flotantes en dark mode.

### Glow on focus / hover
Botones primarios con `shadow-glow` al hover. Inputs con `ring-2 ring-brand-primary` al focus.

### Tipografía de tablas
Por defecto sans. Toggle a mono desde Configuración. Números siempre tabular (`tabular-nums`).

### Animaciones
- Transición de página: fade + slide-up 12px en 250ms.
- Sidebar collapse: spring 380/30.
- Modales: scale 0.96 → 1, fade.
- Skeletons con shimmer (gradient sweep).

## Dark mode

Activado por default. Toggle en header. Sigue `prefers-color-scheme` la primera vez si el usuario no eligió.

## Accesibilidad

- Contraste AA mínimo (verificable con `npx @adobe/leonardo-contrast-colors`).
- Focus visible siempre (`outline-none` solo si hay `focus-visible:ring-...` reemplazo).
- Atajos de teclado documentados en Ayuda → Atajos.
