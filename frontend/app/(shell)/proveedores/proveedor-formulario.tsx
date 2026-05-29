'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, Search, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { obtener, mensajeError } from '@/lib/api/client';
import { FormField } from '@/components/ui/form-field';
import { useValidacionForm } from '@/lib/use-validacion-form';
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
  /** Cuando true se omite el `<Card>` wrapper (el modal aporta el contenedor). */
  enModal?: boolean;
}

type Errores = Partial<Record<keyof ProveedorFormValues, string>>;

interface DatosRucNorm {
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  estado: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  ubigeo: string | null;
}

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

type EstadoConsulta = 'idle' | 'cargando' | 'ok' | 'error';

export function ProveedorFormulario({
  inicial,
  guardando,
  ctaLabel,
  errorServidor,
  onGuardar,
  onCancelar,
  modoEdicion = false,
  enModal = false,
}: Props) {
  const [form, setForm] = React.useState<ProveedorFormValues>({
    ...PROVEEDOR_VACIO,
    ...inicial,
  });
  const [errores, setErrores] = React.useState<Errores>({});
  const [consulta, setConsulta] = React.useState<EstadoConsulta>('idle');
  const [consultaMsg, setConsultaMsg] = React.useState<string | null>(null);
  const ultimoRucConsultadoRef = React.useRef<string>('');

  // Validación universal (toast + scroll + focus al primer faltante).
  const validacion = useValidacionForm<ProveedorFormValues>({
    reglas: [
      {
        id: 'documento',
        label: 'Documento',
        validar: d => (d.documento.trim() ? null : 'El documento es obligatorio'),
        selectorFoco: '[name="documento"]',
      },
      {
        id: 'razonSocial',
        label: 'Razón social',
        validar: d => (d.razonSocial.trim() ? null : 'La razón social es obligatoria'),
        selectorFoco: '[name="razonSocial"]',
      },
    ],
  });

  React.useEffect(() => {
    if (inicial) setForm(prev => ({ ...prev, ...inicial }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  const set = <K extends keyof ProveedorFormValues>(k: K, v: ProveedorFormValues[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrores(e => (e[k] ? { ...e, [k]: undefined } : e));
    validacion.limpiarError(k as string);
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

  // ── Consulta json.pe ── (solo dispara con click explícito en botón SUNAT) ──
  const docLimpio = (form.documento ?? '').replace(/\D+/g, '');

  const consultarRuc = React.useCallback(
    async (rucLimpio: string, opciones: { silenciarToast?: boolean; forzar?: boolean } = {}) => {
      if (consulta === 'cargando') return;
      if (!opciones.forzar && ultimoRucConsultadoRef.current === rucLimpio) return;
      ultimoRucConsultadoRef.current = rucLimpio;
      setConsulta('cargando');
      setConsultaMsg(null);
      try {
        const datos = await obtener<DatosRucNorm>(`/utilidades/ruc/${rucLimpio}`);
        setForm(f => ({
          ...f,
          razonSocial: opciones.forzar || !f.razonSocial.trim() ? datos.razonSocial : f.razonSocial,
          nombreComercial:
            (opciones.forzar || !f.nombreComercial?.trim()) && datos.nombreComercial
              ? datos.nombreComercial
              : f.nombreComercial,
          direccion:
            (opciones.forzar || !f.direccion?.trim()) && datos.direccion
              ? datos.direccion
              : f.direccion,
          ciudad:
            (opciones.forzar || !f.ciudad?.trim()) && (datos.provincia || datos.departamento)
              ? (datos.provincia ?? datos.departamento ?? '')
              : f.ciudad,
        }));
        setErrores(e => ({
          ...e,
          razonSocial: undefined,
          nombreComercial: undefined,
          direccion: undefined,
          ciudad: undefined,
        }));
        setConsulta('ok');
        setConsultaMsg(`SUNAT · ${datos.estado ?? 'sin estado'}`);
        if (!opciones.silenciarToast) toast.success(`RUC encontrado: ${datos.razonSocial}`);
      } catch (err) {
        setConsulta('error');
        const msg = mensajeError(err);
        setConsultaMsg(msg);
        if (!opciones.silenciarToast) toast.error(msg);
      }
    },
    [consulta],
  );

  // Resetear estado de consulta si el usuario cambia el documento
  React.useEffect(() => {
    if (consulta !== 'idle' && docLimpio !== ultimoRucConsultadoRef.current) {
      setConsulta('idle');
      setConsultaMsg(null);
    }
  }, [docLimpio, consulta]);

  const submit = () => {
    const r = validacion.validar(form);
    if (!r.valido) return;
    const parsed = proveedorSchema.safeParse(form);
    if (!parsed.success) {
      const nuevos: Errores = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof ProveedorFormValues | undefined;
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

  const esLibre = form.condicionPago === 'credito_otro';

  // En modal omitimos el `<Card>` (el DialogShell ya provee el contenedor visual).
  const wrapperClass = enModal ? 'space-y-5' : 'p-6 space-y-5 max-w-3xl';

  const contenido = (
    <>
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
        <FormField
          label="Documento"
          htmlFor="documento"
          requerido
          error={validacion.errores.documento ?? errores.documento}
          className="md:col-span-2"
        >
          <div className="flex gap-2 items-stretch">
            <Input
              id="documento"
              name="documento"
              data-testid="input-documento-proveedor"
              value={form.documento}
              onChange={e => set('documento', e.target.value)}
              placeholder={placeholderDoc(form.tipoDocumento)}
              inputMode={form.tipoDocumento === 'ruc' || form.tipoDocumento === 'dni' ? 'numeric' : 'text'}
              maxLength={20}
              autoComplete="off"
              className="flex-1"
            />
            {form.tipoDocumento === 'ruc' && (
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => {
                  if (docLimpio.length !== 11) {
                    toast.error('El RUC debe tener 11 dígitos');
                    return;
                  }
                  void consultarRuc(docLimpio, { forzar: true });
                }}
                disabled={consulta === 'cargando' || docLimpio.length !== 11}
                data-testid="btn-consultar-ruc"
                title="Consultar RUC en SUNAT vía json.pe"
                className="shrink-0"
              >
                {consulta === 'cargando' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : consulta === 'ok' ? (
                  <Check className="size-4 text-[hsl(var(--brand-success))]" />
                ) : (
                  <Search className="size-4" />
                )}
                <span className="hidden sm:inline ml-1">SUNAT</span>
              </Button>
            )}
          </div>
          {consultaMsg && (
            <p
              className={
                'text-[11px] mt-1 ' +
                (consulta === 'ok'
                  ? 'text-[hsl(var(--brand-success))]'
                  : 'text-[hsl(355_75%_70%)]')
              }
              role="status"
            >
              {consultaMsg}
            </p>
          )}
        </FormField>
      </div>

      <FormField
        label="Razón social"
        htmlFor="razonSocial"
        requerido
        error={validacion.errores.razonSocial ?? errores.razonSocial}
      >
        <Input
          id="razonSocial"
          name="razonSocial"
          data-testid="input-razon-social-proveedor"
          value={form.razonSocial}
          onChange={e => set('razonSocial', e.target.value)}
          placeholder="DISTRIBUIDORA TEXTIL SAC"
          maxLength={200}
        />
      </FormField>

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
    </>
  );

  return enModal ? (
    <div className={wrapperClass} onKeyDown={onKeyDown}>
      {contenido}
    </div>
  ) : (
    <Card className={wrapperClass} onKeyDown={onKeyDown}>
      {contenido}
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
