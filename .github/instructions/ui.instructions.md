---
applyTo: "frontend/**/*.{ts,tsx,css}"
---

# UI / Frontend — convenciones obligatorias

## Stack y librerías

| Para | Usa |
|------|-----|
| Componentes base | shadcn/ui (Radix + cva) |
| Estilos | Tailwind CSS v4 con CSS vars |
| Animaciones | Framer Motion |
| Iconos | lucide-react |
| Forms | react-hook-form + zod |
| Tablas | TanStack Table |
| Data fetching | TanStack Query |
| Estado cliente | Zustand (pequeños slices, no global god-store) |
| Toasts | sonner |
| Modales/dialogs | shadcn/ui Dialog + AlertDialog |

## Design tokens (CSS vars)

Definidos en `frontend/styles/tokens.css`. Resumen:

```css
:root {
  /* Brand brutal — magenta + cyber lime */
  --brand-primary: 280 95% 55%;       /* HSL — violeta eléctrico */
  --brand-accent: 70 95% 60%;         /* lime cyber */
  --brand-success: 150 70% 45%;
  --brand-danger: 355 85% 60%;
  --brand-warning: 35 95% 55%;

  /* Neutrales */
  --bg: 0 0% 100%;
  --surface: 220 14% 96%;
  --surface-2: 220 13% 91%;
  --border: 220 13% 86%;
  --text: 220 13% 15%;
  --text-muted: 220 9% 46%;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;
  --font-display: 'Geist', sans-serif;

  --base-font-size: 14px;
}

[data-theme="dark"] {
  --bg: 240 10% 3.9%;
  --surface: 240 5.9% 10%;
  --surface-2: 240 4.8% 16%;
  --border: 240 3.7% 22%;
  --text: 0 0% 98%;
  --text-muted: 240 5% 64.9%;
}
```

Tailwind consume estas vars vía `hsl(var(--brand-primary) / <alpha>)`.

## Layout shell

`app/(shell)/layout.tsx` define:
- Sidebar colapsable (200px abierto, 64px cerrado) con animación spring
- Header sticky con buscador global Ctrl+K, switcher de tema, perfil
- Main scrollable
- Toaster (sonner) montado al final

## Tablas

Estructura obligatoria con TanStack Table + shadcn `<Table>`. Cada tabla:
1. Tiene paginación, filtro de búsqueda, orden por columna
2. Permite expandir fila para ver detalle (grid 2-3 cols dentro)
3. Acciones (editar, eliminar) con `Tooltip` y `lucide-react` icons
4. Footer con `<total> registros · Página X de Y · ← →`

## Buscador global Ctrl+K

`components/command-palette.tsx` usa `cmdk`. Cada feature registra sus entradas vía hook `useRegisterCommand`:

```ts
useRegisterCommand({
  group: 'Ventas',
  label: 'Nueva venta',
  shortcut: 'N V',
  icon: ShoppingCartIcon,
  action: () => router.push('/ventas/nueva'),
});
```

## Word-split search

Helper `lib/search.ts` divide query en palabras y construye filtros AND/OR. Todos los inputs de búsqueda llevan `data-busqueda` (el listener global Shift+Space los limpia y enfoca).

## Animaciones

- Entrada de páginas: `motion.div` con `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}`
- Modales: scale + fade
- Sidebar collapse: `layout` + spring `{ stiffness: 380, damping: 30 }`
- NO animar más de 250ms para acciones de UI
- Respetar `prefers-reduced-motion`

## Tipografía dinámica

`Settings → Apariencia` permite cambiar `--font-sans` y `--base-font-size`. El cambio aplica vía `document.documentElement.style.setProperty(...)` y persiste en localStorage. Tablas pueden alternar a monospace con clase `.tabla-mono`.

## Iconos

Usar `lucide-react`. Helpers:
```tsx
<Edit2Icon className="size-4" />
<Trash2Icon className="size-4 text-danger" />
```

NO usar SVG inline en acciones recurrentes (editar/eliminar/ver). NO mezclar emojis con iconos en la misma fila.

## Responsivo

- Mobile-first. Sidebar se vuelve drawer en `<md`.
- Tablas en mobile: stack vertical o scroll horizontal con sombra de hint.
- Inputs de filtro colapsan a un sheet desde abajo.

## Lo que NO hacer

- `any` en props o estados.
- `useEffect` para fetch — usar TanStack Query.
- `<div onClick>` para acciones — usar `<Button variant="ghost">`.
- Importar de `@/components/ui/*` componentes que no existan — primero `npx shadcn add`.
- Emoji como UI principal (✅❌🚀): solo decorativos en empty states o microcopy.
