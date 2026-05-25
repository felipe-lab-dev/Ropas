'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, Sparkles } from 'lucide-react';
import {
  APLICABLE_A,
  APLICABLE_LABEL,
  CUPON_VACIO,
  SEGMENTO_LABEL,
  SEGMENTOS,
  TIPO_DESCUENTO,
  TIPO_LABEL,
  cuponSchema,
  type CuponFormValues,
} from './cupon-schema';
import { CuponPreview } from './cupon-preview';

interface Props {
  inicial?: Partial<CuponFormValues>;
  guardando: boolean;
  ctaLabel: string;
  errorServidor?: string | null;
  onGuardar: (v: CuponFormValues) => void;
  onCancelar?: () => void;
  modoEdicion?: boolean;
  tiendaNombre?: string;
}

type Errores = Partial<Record<keyof CuponFormValues, string>>;

const EMOJIS_SUGERIDOS = ['🔥', '⚡', '🎉', '👑', '💀', '🎂', '🛒', '⏳', '💎', '🛍️'];
const COLORES_SUGERIDOS = [
  { primario: '#7c3aed', secundario: '#1e1b4b', nombre: 'Violeta noche' },
  { primario: '#dc2626', secundario: '#450a0a', nombre: 'Rojo urgente' },
  { primario: '#f59e0b', secundario: '#451a03', nombre: 'Ámbar flash' },
  { primario: '#0891b2', secundario: '#083344', nombre: 'Cyan ROI' },
  { primario: '#ec4899', secundario: '#500724', nombre: 'Rosa cumple' },
  { primario: '#16a34a', secundario: '#052e16', nombre: 'Verde ganancia' },
];

export function CuponFormulario({
  inicial,
  guardando,
  ctaLabel,
  errorServidor,
  onGuardar,
  onCancelar,
  modoEdicion = false,
  tiendaNombre = 'Mi Tienda',
}: Props) {
  const [form, setForm] = React.useState<CuponFormValues>({ ...CUPON_VACIO, ...inicial });
  const [errores, setErrores] = React.useState<Errores>({});

  React.useEffect(() => {
    if (inicial) setForm(prev => ({ ...prev, ...inicial }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  const set = <K extends keyof CuponFormValues>(k: K, v: CuponFormValues[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrores(e => (e[k] ? { ...e, [k]: undefined } : e));
  };

  const submit = () => {
    const parsed = cuponSchema.safeParse(form);
    if (!parsed.success) {
      const nuevos: Errores = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof CuponFormValues | undefined;
        if (k && !nuevos[k]) nuevos[k] = issue.message;
      }
      setErrores(nuevos);
      const primer = parsed.error.issues[0]?.path[0];
      if (primer) {
        const el = document.querySelector<HTMLElement>(`[name="${primer}"]`);
        el?.focus();
      }
      return;
    }
    onGuardar(parsed.data);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
      <Card className="p-6 space-y-6 max-w-3xl" onKeyDown={onKeyDown}>
        {/* IDENTIDAD */}
        <Seccion titulo="Identidad" descripcion="Cómo aparece el cupón al cliente y en el sistema.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Campo label="Código *" error={errores.codigo} className="md:col-span-1">
              <Input
                name="codigo"
                value={form.codigo}
                onChange={e => set('codigo', e.target.value.toUpperCase())}
                placeholder="VERANO25"
                className="font-mono uppercase"
                maxLength={40}
                disabled={modoEdicion}
                autoComplete="off"
              />
            </Campo>
            <Campo label="Nombre *" error={errores.nombre} className="md:col-span-2">
              <Input
                name="nombre"
                value={form.nombre}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Verano 2026 — 25% en toda la tienda"
                maxLength={160}
              />
            </Campo>
          </div>

          <Campo label="Descripción interna" error={errores.descripcion}>
            <Textarea
              name="descripcion"
              value={form.descripcion ?? ''}
              onChange={e => set('descripcion', e.target.value)}
              rows={2}
              placeholder="A quién va dirigido, qué buscás lograr, condiciones especiales…"
              maxLength={2000}
            />
          </Campo>

          <Campo label="Campaña (etiqueta)" error={errores.campania}>
            <Input
              name="campania"
              value={form.campania ?? ''}
              onChange={e => set('campania', e.target.value)}
              placeholder="Black Friday 2026"
              maxLength={120}
            />
          </Campo>
        </Seccion>

        {/* DESCUENTO */}
        <Seccion titulo="Descuento" descripcion="Cuánto regalás y bajo qué condiciones.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Campo label="Tipo *" error={errores.tipoDescuento}>
              <Select
                name="tipoDescuento"
                value={form.tipoDescuento}
                onChange={e => set('tipoDescuento', e.target.value as CuponFormValues['tipoDescuento'])}
              >
                {TIPO_DESCUENTO.map(t => (
                  <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                ))}
              </Select>
            </Campo>
            <Campo label={form.tipoDescuento === 'porcentaje' ? 'Porcentaje *' : 'Monto S/ *'} error={errores.valorDescuento}>
              <Input
                name="valorDescuento"
                type="number"
                min={0.01}
                max={form.tipoDescuento === 'porcentaje' ? 100 : undefined}
                step={form.tipoDescuento === 'porcentaje' ? 1 : 0.5}
                value={form.valorDescuento}
                onChange={e => set('valorDescuento', Number(e.target.value) || 0)}
                inputMode="decimal"
              />
            </Campo>
            <Campo label="Descuento máx. S/" error={errores.descuentoMaximo}>
              <Input
                name="descuentoMaximo"
                type="number"
                min={0}
                step={1}
                value={form.descuentoMaximo ?? ''}
                onChange={e => set('descuentoMaximo', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="Tope (opcional)"
                inputMode="decimal"
              />
            </Campo>
          </div>

          <Campo label="Compra mínima S/" error={errores.montoMinimoCompra}>
            <Input
              name="montoMinimoCompra"
              type="number"
              min={0}
              step={1}
              value={form.montoMinimoCompra ?? ''}
              onChange={e => set('montoMinimoCompra', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="Sin mínimo"
              inputMode="decimal"
            />
          </Campo>
        </Seccion>

        {/* VIGENCIA */}
        <Seccion titulo="Vigencia y límites" descripcion="Cuándo es válido y cuántas veces puede usarse.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Desde *" error={errores.fechaInicio}>
              <Input
                name="fechaInicio"
                type="datetime-local"
                value={form.fechaInicio}
                onChange={e => set('fechaInicio', e.target.value)}
              />
            </Campo>
            <Campo label="Hasta *" error={errores.fechaFin}>
              <Input
                name="fechaFin"
                type="datetime-local"
                value={form.fechaFin}
                onChange={e => set('fechaFin', e.target.value)}
              />
            </Campo>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Usos totales" error={errores.usosMaximosTotal}>
              <Input
                name="usosMaximosTotal"
                type="number"
                min={1}
                step={1}
                value={form.usosMaximosTotal ?? ''}
                onChange={e =>
                  set('usosMaximosTotal', e.target.value === '' ? null : Number(e.target.value))
                }
                placeholder="Ilimitado"
              />
            </Campo>
            <Campo label="Usos por cliente *" error={errores.usosMaximosPorCliente}>
              <Input
                name="usosMaximosPorCliente"
                type="number"
                min={1}
                max={100}
                step={1}
                value={form.usosMaximosPorCliente}
                onChange={e => set('usosMaximosPorCliente', Number(e.target.value) || 1)}
              />
            </Campo>
          </div>
        </Seccion>

        {/* SEGMENTACIÓN */}
        <Seccion titulo="Segmento" descripcion="A qué clientes va dirigido.">
          <Campo label="Segmento objetivo *" error={errores.segmento}>
            <Select
              name="segmento"
              value={form.segmento}
              onChange={e => set('segmento', e.target.value as CuponFormValues['segmento'])}
            >
              {SEGMENTOS.map(s => (
                <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>
              ))}
            </Select>
          </Campo>
          {form.segmento === 'lista_clientes' && (
            <div className="p-3 rounded-md bg-[hsl(var(--surface-2))] text-xs text-[hsl(var(--text-muted))]">
              💡 Lista específica: agrega cliente IDs en el detalle del cupón después de crearlo
              (o usa el wizard avanzado próximamente).
            </div>
          )}
        </Seccion>

        {/* APLICABILIDAD */}
        <Seccion titulo="Aplicabilidad" descripcion="Sobre qué se aplica el descuento.">
          <Campo label="Aplica a *" error={errores.aplicableA}>
            <Select
              name="aplicableA"
              value={form.aplicableA}
              onChange={e => set('aplicableA', e.target.value as CuponFormValues['aplicableA'])}
            >
              {APLICABLE_A.map(a => (
                <option key={a} value={a}>{APLICABLE_LABEL[a]}</option>
              ))}
            </Select>
          </Campo>
          {(form.aplicableA === 'categorias' || form.aplicableA === 'productos') && (
            <div className="p-3 rounded-md bg-[hsl(var(--surface-2))] text-xs text-[hsl(var(--text-muted))]">
              💡 Selección de {form.aplicableA}: agrega los IDs en el detalle después de crear.
            </div>
          )}
        </Seccion>

        {/* DISEÑO VISUAL */}
        <Seccion titulo="Diseño visual" descripcion="Cómo se ve el voucher en PDF, PNG y pantalla.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Color primario">
              <div className="flex gap-2 items-center">
                <Input
                  name="disenoColorPrimario"
                  value={form.disenoColorPrimario}
                  onChange={e => set('disenoColorPrimario', e.target.value)}
                  className="font-mono"
                  maxLength={9}
                />
                <input
                  type="color"
                  value={form.disenoColorPrimario.slice(0, 7)}
                  onChange={e => set('disenoColorPrimario', e.target.value)}
                  className="size-10 rounded border border-[hsl(var(--border))]"
                  aria-label="Color primario"
                />
              </div>
            </Campo>
            <Campo label="Color secundario">
              <div className="flex gap-2 items-center">
                <Input
                  name="disenoColorSecundario"
                  value={form.disenoColorSecundario}
                  onChange={e => set('disenoColorSecundario', e.target.value)}
                  className="font-mono"
                  maxLength={9}
                />
                <input
                  type="color"
                  value={form.disenoColorSecundario.slice(0, 7)}
                  onChange={e => set('disenoColorSecundario', e.target.value)}
                  className="size-10 rounded border border-[hsl(var(--border))]"
                  aria-label="Color secundario"
                />
              </div>
            </Campo>
          </div>

          <Campo label="Paletas brutales">
            <div className="flex flex-wrap gap-2">
              {COLORES_SUGERIDOS.map(p => (
                <button
                  key={p.nombre}
                  type="button"
                  onClick={() => {
                    set('disenoColorPrimario', p.primario);
                    set('disenoColorSecundario', p.secundario);
                  }}
                  className="group flex items-center gap-2 px-2 py-1 rounded-md bg-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-3))] text-xs"
                  title={p.nombre}
                >
                  <span
                    className="size-4 rounded"
                    style={{
                      background: `linear-gradient(135deg, ${p.primario}, ${p.secundario})`,
                    }}
                  />
                  {p.nombre}
                </button>
              ))}
            </div>
          </Campo>

          <Campo label="Emoji decorativo">
            <div className="flex flex-wrap gap-1">
              {EMOJIS_SUGERIDOS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => set('disenoEmoji', e)}
                  className={`size-9 grid place-items-center rounded-md text-lg hover:bg-[hsl(var(--surface-2))] ${
                    form.disenoEmoji === e ? 'bg-[hsl(var(--surface-3))] ring-2 ring-[hsl(var(--brand-primary))]' : ''
                  }`}
                >
                  {e}
                </button>
              ))}
              <Input
                name="disenoEmoji"
                value={form.disenoEmoji ?? ''}
                onChange={e => set('disenoEmoji', e.target.value)}
                placeholder="otro"
                maxLength={8}
                className="w-20 text-center"
              />
            </div>
          </Campo>

          <Campo label="Mensaje (copy de impacto)" error={errores.disenoMensaje}>
            <Input
              name="disenoMensaje"
              value={form.disenoMensaje ?? ''}
              onChange={e => set('disenoMensaje', e.target.value)}
              placeholder="Solo por 72 horas — vence y no se renueva"
              maxLength={240}
            />
          </Campo>
        </Seccion>

        {errorServidor && (
          <div
            role="alert"
            className="rounded-lg border border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)] p-3 text-sm text-[hsl(355_75%_75%)]"
          >
            {errorServidor}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end pt-2">
          {onCancelar && (
            <Button variant="ghost" onClick={onCancelar} type="button" disabled={guardando}>
              Cancelar
            </Button>
          )}
          <Button size="lg" type="button" disabled={guardando} onClick={submit} data-testid="cupon-guardar">
            <Save className="size-4" /> {guardando ? 'Guardando…' : ctaLabel}
          </Button>
        </div>
      </Card>

      {/* PREVIEW vivo, sticky */}
      <div className="lg:sticky lg:top-6 self-start space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--text-muted))]">
          <Sparkles className="size-3.5" /> Vista previa en vivo
        </div>
        <CuponPreview
          codigo={form.codigo || 'XXXXXX'}
          nombre={form.nombre || 'Nombre del cupón'}
          tipoDescuento={form.tipoDescuento}
          valorDescuento={form.valorDescuento}
          fechaFin={form.fechaFin}
          montoMinimoCompra={form.montoMinimoCompra ?? null}
          campania={form.campania ?? null}
          disenoColorPrimario={form.disenoColorPrimario}
          disenoColorSecundario={form.disenoColorSecundario}
          disenoMensaje={form.disenoMensaje ?? null}
          disenoEmoji={form.disenoEmoji ?? null}
          tienda={tiendaNombre}
        />
        <p className="text-[10px] text-[hsl(var(--text-muted))] max-w-[420px]">
          Así verá el cupón el cliente en PDF, imagen WhatsApp y pantalla. El QR final se genera
          al guardar con el código real.
        </p>
      </div>
    </div>
  );
}

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 pb-4 border-b border-[hsl(var(--border))] last:border-b-0 last:pb-0">
      <div>
        <h3 className="font-semibold text-sm">{titulo}</h3>
        {descripcion && (
          <p className="text-[11px] text-[hsl(var(--text-muted))] mt-0.5">{descripcion}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Campo({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-muted))]">
        {label}
      </Label>
      {children}
      {error && (
        <p className="text-[11px] text-[hsl(355_75%_70%)] mt-1" role="alert">{error}</p>
      )}
    </div>
  );
}
