'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import {
  CONDICION_LABEL,
  CONDICION_PAGO,
  diasSugeridos,
  PROVEEDOR_VACIO,
  proveedorSchema,
  TIPO_DOC,
  type ProveedorFormValues,
} from './proveedor-schema';

interface Props {
  inicial?: Partial<ProveedorFormValues>;
  guardando: boolean;
  ctaLabel: string;
  errorServidor?: string | null;
  onGuardar: (valores: ProveedorFormValues) => void;
  onCancelar?: () => void;
  modoEdicion?: boolean;
}

type Errores = Partial<Record<keyof ProveedorFormValues, string>>;

const TIPO_LABEL: Record<(typeof TIPO_DOC)[number], string> = {
  ruc: 'RUC',
  dni: 'DNI',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  pasaporte: 'Pasaporte',
  otro: 'Otro',
};

function placeholderDoc(tipo: (typeof TIPO_DOC)[number]) {
  if (tipo === 'ruc') return '20123456789 (11 dígitos)';
  if (tipo === 'dni') return '12345678 (8 dígitos)';
  return 'Número de documento';
}

export function ProveedorFormulario({
  inicial,
  guardando,
  ctaLabel,
  errorServidor,
  onGuardar,
  onCancelar,
  modoEdicion = false,
}: Props) {
  const [form, setForm] = React.useState<ProveedorFormValues>({
    ...PROVEEDOR_VACIO,
    ...inicial,
  });
  const [errores, setErrores] = React.useState<Errores>({});

  React.useEffect(() => {
    if (inicial) setForm(prev => ({ ...prev, ...inicial }));
    // Solo se recarga cuando cambia la identidad del objeto inicial (carga remota).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  const set = <K extends keyof ProveedorFormValues>(k: K, v: ProveedorFormValues[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrores(e => (e[k] ? { ...e, [k]: undefined } : e));
  };

  const cambiarCondicion = (c: ProveedorFormValues['condicionPago']) => {
    const dias = diasSugeridos(c);
    setForm(f => ({
      ...f,
      condicionPago: c,
      diasCredito: dias === null ? Math.max(f.diasCredito, 1) : dias,
    }));
    setErrores(e => ({ ...e, condicionPago: undefined, diasCredito: undefined }));
  };

  const submit = () => {
    const parsed = proveedorSchema.safeParse(form);
    if (!parsed.success) {
      const nuevos: Errores = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof ProveedorFormValues | undefined;
        if (k && !nuevos[k]) nuevos[k] = issue.message;
      }
      setErrores(nuevos);
      // Enfocar el primer campo con error
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
    // Ctrl/Cmd + Enter envía
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  const esLibre = form.condicionPago === 'credito_otro';

  return (
    <Card className="p-6 space-y-5 max-w-3xl" onKeyDown={onKeyDown}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Campo label="Tipo doc." error={errores.tipoDocumento}>
          <Select
            name="tipoDocumento"
            data-testid="select-tipo-doc-proveedor"
            value={form.tipoDocumento}
            onChange={e => set('tipoDocumento', e.target.value as ProveedorFormValues['tipoDocumento'])}
          >
            {TIPO_DOC.map(t => (
              <option key={t} value={t}>{TIPO_LABEL[t]}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Documento *" error={errores.documento} className="md:col-span-2">
          <Input
            name="documento"
            data-testid="input-documento-proveedor"
            value={form.documento}
            onChange={e => set('documento', e.target.value)}
            placeholder={placeholderDoc(form.tipoDocumento)}
            inputMode={form.tipoDocumento === 'ruc' || form.tipoDocumento === 'dni' ? 'numeric' : 'text'}
            maxLength={20}
            autoComplete="off"
          />
        </Campo>
      </div>

      <Campo label="Razón social *" error={errores.razonSocial}>
        <Input
          name="razonSocial"
          data-testid="input-razon-social-proveedor"
          value={form.razonSocial}
          onChange={e => set('razonSocial', e.target.value)}
          placeholder="DISTRIBUIDORA TEXTIL SAC"
          maxLength={200}
        />
      </Campo>

      <Campo label="Nombre comercial" error={errores.nombreComercial}>
        <Input
          name="nombreComercial"
          data-testid="input-nombre-comercial-proveedor"
          value={form.nombreComercial ?? ''}
          onChange={e => set('nombreComercial', e.target.value)}
          placeholder="Como se conoce a la empresa"
          maxLength={160}
        />
      </Campo>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Campo label="Contacto" error={errores.contacto}>
          <Input
            name="contacto"
            value={form.contacto ?? ''}
            onChange={e => set('contacto', e.target.value)}
            placeholder="Nombre del vendedor"
            maxLength={120}
          />
        </Campo>
        <Campo label="Teléfono" error={errores.telefono}>
          <Input
            name="telefono"
            value={form.telefono ?? ''}
            onChange={e => set('telefono', e.target.value)}
            placeholder="+51 999 999 999"
            inputMode="tel"
            maxLength={40}
          />
        </Campo>
        <Campo label="Email" error={errores.email}>
          <Input
            name="email"
            type="email"
            value={form.email ?? ''}
            onChange={e => set('email', e.target.value)}
            placeholder="ventas@proveedor.com"
            inputMode="email"
            autoComplete="email"
            maxLength={160}
          />
        </Campo>
        <Campo label="Ciudad" error={errores.ciudad}>
          <Input
            name="ciudad"
            value={form.ciudad ?? ''}
            onChange={e => set('ciudad', e.target.value)}
            placeholder="Lima"
            maxLength={120}
          />
        </Campo>
      </div>

      <Campo label="Dirección" error={errores.direccion}>
        <Input
          name="direccion"
          value={form.direccion ?? ''}
          onChange={e => set('direccion', e.target.value)}
          placeholder="Av. Industrial 123 — Lima"
          maxLength={240}
        />
      </Campo>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Campo label="Condición de pago" error={errores.condicionPago}>
          <Select
            name="condicionPago"
            data-testid="select-condicion-pago-proveedor"
            value={form.condicionPago}
            onChange={e => cambiarCondicion(e.target.value as ProveedorFormValues['condicionPago'])}
          >
            {CONDICION_PAGO.map(c => (
              <option key={c} value={c}>{CONDICION_LABEL[c]}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Días crédito" error={errores.diasCredito}>
          <Input
            name="diasCredito"
            type="number"
            min={0}
            max={365}
            value={form.diasCredito}
            onChange={e => set('diasCredito', Number(e.target.value) || 0)}
            disabled={!esLibre && form.condicionPago !== 'credito_otro' && form.condicionPago === 'contado'}
            readOnly={form.condicionPago !== 'credito_otro' && form.condicionPago !== 'contado'}
            aria-describedby="diasCreditoHint"
          />
          {!esLibre && form.condicionPago !== 'contado' && (
            <p id="diasCreditoHint" className="text-[11px] text-[hsl(var(--text-muted))] mt-1">
              Cambia la condición a "Crédito (otro)" para editar manualmente.
            </p>
          )}
        </Campo>
        <Campo label="Cuenta bancaria" error={errores.cuentaBancaria}>
          <Input
            name="cuentaBancaria"
            value={form.cuentaBancaria ?? ''}
            onChange={e => set('cuentaBancaria', e.target.value)}
            placeholder="BCP 194-..."
            maxLength={60}
          />
        </Campo>
      </div>

      <Campo label="Notas" error={errores.notas}>
        <Textarea
          name="notas"
          value={form.notas ?? ''}
          onChange={e => set('notas', e.target.value)}
          rows={3}
          placeholder="Marcas que distribuye, frecuencia de entrega, restricciones…"
          maxLength={2000}
        />
      </Campo>

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
          <Button
            variant="ghost"
            data-testid="btn-cancelar-proveedor"
            onClick={onCancelar}
            type="button"
            disabled={guardando}
          >
            Cancelar
          </Button>
        )}
        <Button
          size="lg"
          type="button"
          data-testid="btn-guardar-proveedor"
          disabled={guardando}
          onClick={submit}
        >
          <Save className="size-4" /> {guardando ? 'Guardando…' : ctaLabel}
        </Button>
      </div>

      {!modoEdicion && (
        <p className="text-[11px] text-[hsl(var(--text-muted))] text-right">
          Atajo: <kbd className="px-1 py-0.5 rounded bg-[hsl(var(--surface-2))] text-[10px]">Ctrl</kbd> +{' '}
          <kbd className="px-1 py-0.5 rounded bg-[hsl(var(--surface-2))] text-[10px]">Enter</kbd> guarda.
        </p>
      )}
    </Card>
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
