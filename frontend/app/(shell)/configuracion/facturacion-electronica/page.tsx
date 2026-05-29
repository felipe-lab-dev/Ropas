'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { FormField } from '@/components/ui/form-field';
import { SelectorUbigeo } from '@/components/sunat/selector-ubigeo';
import {
  useConfiguracionFacturacion,
  useGuardarConfiguracionFacturacion,
  type GuardarConfiguracionFacturacionInput,
} from '@/lib/api/hooks/use-configuracion-facturacion';
import { mensajeError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

// ─── Schema de validación ─────────────────────────────────────────────────────

const schema = z.object({
  ruc: z.string().regex(/^\d{11}$/, 'RUC debe tener 11 dígitos'),
  razonSocial: z.string().min(1, 'Razón social requerida').max(200),
  nombreComercial: z.string().max(200).optional().nullable(),
  direccionFiscal: z.string().min(1, 'Dirección fiscal requerida').max(240),
  ubigeoFiscalCodigo: z
    .string()
    .regex(/^\d{6}$/, 'Selecciona un UBIGEO válido'),
  mifactToken: z.string().optional(),
  mifactBaseUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  enviarAutomaticoASunat: z.boolean(),
  retornarPdf: z.boolean(),
  retornarXmlEnvio: z.boolean(),
  retornarXmlCdr: z.boolean(),
  formatoImpresion: z.enum(['001', '002', '004']),
});

type FormValues = z.infer<typeof schema>;

// ─── Componente: Toggle de boolean ───────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  descripcion,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  descripcion?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 w-full text-left group"
    >
      <div
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out focus:outline-none mt-0.5',
          checked
            ? 'bg-[hsl(var(--brand-primary))]'
            : 'bg-[hsl(var(--border))]',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block size-5 rounded-full bg-white shadow-md',
            'transform transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-[hsl(var(--text))]">{label}</div>
        {descripcion && (
          <div className="text-xs text-[hsl(var(--text-muted))] mt-0.5">{descripcion}</div>
        )}
      </div>
    </button>
  );
}

// ─── Componente: RadioFormato ─────────────────────────────────────────────────

const FORMATOS = [
  { value: '001', label: 'A4', desc: 'Hoja carta estándar' },
  { value: '002', label: 'A5', desc: 'Media hoja' },
  { value: '004', label: 'Ticket 80mm', desc: 'Impresora térmica' },
] as const;

function RadioFormato({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FORMATOS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={cn(
            'flex-1 min-w-[100px] rounded-lg border-2 p-3 text-sm text-center transition-all',
            value === f.value
              ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10 text-[hsl(var(--brand-primary))]'
              : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40',
          )}
        >
          <div className="font-semibold">{f.label}</div>
          <div className="text-[10px] text-[hsl(var(--text-muted))]">{f.desc}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Componente: CampoToken ───────────────────────────────────────────────────

function CampoToken({
  tokenConfigurado,
  value,
  onChange,
  error,
}: {
  tokenConfigurado: boolean;
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [editando, setEditando] = React.useState(!tokenConfigurado);
  const [visible, setVisible] = React.useState(false);

  if (!editando && tokenConfigurado) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 px-3.5 text-sm text-[hsl(var(--text-muted))]">
          <CheckCircle2 className="size-4 text-[hsl(var(--brand-success))] shrink-0" />
          <span>Token configurado (●●●●●●●●●●●●)</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditando(true);
            setVisible(false);
          }}
        >
          Editar token
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {tokenConfigurado && editando && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-[hsl(var(--brand-warning))]/10 text-[hsl(var(--brand-warning))] border border-[hsl(var(--brand-warning))]/20"
        >
          <AlertTriangle className="size-4 shrink-0" />
          Vas a reemplazar el token actual. Si dejás el campo vacío, se mantiene el existente.
        </motion.div>
      )}
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            tokenConfigurado
              ? 'Nuevo token (dejar vacío para mantener el actual)'
              : 'Token de acceso Mifact OSE'
          }
          className="pr-10 font-mono text-sm"
          autoComplete="off"
          data-testid="input-token"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))] transition-colors"
          aria-label={visible ? 'Ocultar token' : 'Mostrar token'}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-[hsl(var(--brand-danger))]">{error}</p>}
    </div>
  );
}

// ─── Sección del formulario ───────────────────────────────────────────────────

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Campo({
  label,
  children,
  error,
  opcional,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  opcional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {opcional && (
          <span className="ml-1.5 normal-case text-[10px] font-normal text-[hsl(var(--text-muted))]">
            (opcional)
          </span>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-[hsl(var(--brand-danger))]">{error}</p>}
    </div>
  );
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────

function FormSkeleton() {
  return (
    <div className="space-y-4 max-w-5xl">
      {[160, 100, 140, 100, 120].map((w, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className={`h-10 w-full`} />
            <Skeleton className="h-10 w-full" />
            {i < 2 && <Skeleton className="h-10 w-full" />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfiguracionFacturacionPage() {
  const { data: config, isLoading } = useConfiguracionFacturacion();
  const guardar = useGuardarConfiguracionFacturacion();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ruc: '',
      razonSocial: '',
      nombreComercial: '',
      direccionFiscal: '',
      ubigeoFiscalCodigo: '',
      mifactToken: '',
      mifactBaseUrl: 'https://demo.mifact.net.pe/api',
      enviarAutomaticoASunat: true,
      retornarPdf: true,
      retornarXmlEnvio: false,
      retornarXmlCdr: false,
      formatoImpresion: '001',
    },
  });

  // Rellenar form cuando llega la config
  React.useEffect(() => {
    if (config) {
      reset({
        ruc: config.ruc,
        razonSocial: config.razonSocial,
        nombreComercial: config.nombreComercial ?? '',
        direccionFiscal: config.direccionFiscal,
        ubigeoFiscalCodigo: config.ubigeoFiscalCodigo,
        mifactToken: '',
        mifactBaseUrl: config.mifactBaseUrl,
        enviarAutomaticoASunat: config.enviarAutomaticoASunat,
        retornarPdf: config.retornarPdf,
        retornarXmlEnvio: config.retornarXmlEnvio,
        retornarXmlCdr: config.retornarXmlCdr,
        formatoImpresion: config.formatoImpresion as '001' | '002' | '004',
      });
    }
  }, [config, reset]);

  const onSubmit = async (valores: FormValues) => {
    try {
      const dto: GuardarConfiguracionFacturacionInput = {
        ruc: valores.ruc,
        razonSocial: valores.razonSocial,
        nombreComercial: valores.nombreComercial || null,
        direccionFiscal: valores.direccionFiscal,
        ubigeoFiscalCodigo: valores.ubigeoFiscalCodigo,
        mifactBaseUrl: valores.mifactBaseUrl || undefined,
        enviarAutomaticoASunat: valores.enviarAutomaticoASunat,
        retornarPdf: valores.retornarPdf,
        retornarXmlEnvio: valores.retornarXmlEnvio,
        retornarXmlCdr: valores.retornarXmlCdr,
        formatoImpresion: valores.formatoImpresion,
      };
      if (valores.mifactToken?.trim()) {
        dto.mifactToken = valores.mifactToken;
      }
      await guardar.mutateAsync(dto);
      toast.success('Configuración guardada');
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  const tokenConfigurado = config?.tokenConfigurado ?? false;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          titulo="Facturación Electrónica"
          descripcion="Configuración SUNAT / Mifact OSE"
        />
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-muted))]">
        <span>Configuración</span>
        <ChevronRight className="size-3.5" />
        <span className="text-[hsl(var(--text))] font-medium">Facturación Electrónica</span>
      </div>

      <PageHeader
        titulo="Facturación Electrónica"
        descripcion="Datos del emisor, conexión a Mifact OSE y opciones de comportamiento SUNAT."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <div className="space-y-4">
        {/* ── Datos del emisor ─────────────────────────────────────── */}
        <Seccion titulo="Datos del emisor">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              label="RUC"
              htmlFor="ruc"
              requerido
              error={errors.ruc?.message}
            >
              <Input
                id="ruc"
                {...register('ruc')}
                placeholder="20100100100"
                maxLength={11}
                inputMode="numeric"
                data-testid="input-ruc"
              />
            </FormField>
            <FormField
              label="Razón social"
              htmlFor="razonSocial"
              requerido
              error={errors.razonSocial?.message}
            >
              <Input
                id="razonSocial"
                {...register('razonSocial')}
                placeholder="Mi Empresa S.A.C."
                data-testid="input-razon-social"
              />
            </FormField>
          </div>
          <Campo label="Nombre comercial" error={errors.nombreComercial?.message} opcional>
            <Input
              {...register('nombreComercial')}
              placeholder="Mi Tienda"
            />
          </Campo>
        </Seccion>

        {/* ── Domicilio fiscal ─────────────────────────────────────── */}
        <Seccion titulo="Domicilio fiscal">
          <FormField
            label="Dirección"
            htmlFor="direccionFiscal"
            requerido
            error={errors.direccionFiscal?.message}
          >
            <Input
              id="direccionFiscal"
              {...register('direccionFiscal')}
              placeholder="Av. La Marina 123"
              data-testid="input-direccion"
            />
          </FormField>
          <FormField
            label="UBIGEO"
            htmlFor="ubigeoFiscalCodigo"
            requerido
            error={errors.ubigeoFiscalCodigo?.message}
          >
            <Controller
              name="ubigeoFiscalCodigo"
              control={control}
              render={({ field }) => (
                <SelectorUbigeo
                  value={field.value || undefined}
                  onChange={(v) => field.onChange(v ?? '')}
                  data-testid="selector-ubigeo"
                />
              )}
            />
          </FormField>
        </Seccion>
        </div>

        <div className="space-y-4">
        {/* ── Conexión Mifact OSE ──────────────────────────────────── */}
        <Seccion titulo="Conexión Mifact OSE">
          <Campo label="Base URL" error={errors.mifactBaseUrl?.message}>
            <Input
              {...register('mifactBaseUrl')}
              placeholder="https://demo.mifact.net.pe/api"
              type="url"
            />
          </Campo>
          <div className="space-y-1.5">
            <Label>Token Mifact</Label>
            <Controller
              name="mifactToken"
              control={control}
              render={({ field }) => (
                <CampoToken
                  tokenConfigurado={tokenConfigurado}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.mifactToken?.message}
                />
              )}
            />
          </div>
        </Seccion>

        {/* ── Comportamiento ───────────────────────────────────────── */}
        <Seccion titulo="Comportamiento">
          <div className="space-y-4">
            <Controller
              name="enviarAutomaticoASunat"
              control={control}
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onChange={field.onChange}
                  label="Enviar a SUNAT en forma sincrónica"
                  descripcion="El comprobante se envía a SUNAT en el mismo request. Si está desactivado, se encola."
                />
              )}
            />
            <Controller
              name="retornarPdf"
              control={control}
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onChange={field.onChange}
                  label="Retornar PDF"
                  descripcion="Mifact devuelve la URL del PDF del comprobante."
                />
              )}
            />
            <Controller
              name="retornarXmlEnvio"
              control={control}
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onChange={field.onChange}
                  label="Retornar XML enviado"
                  descripcion="Incluye la URL del XML que se envió a SUNAT."
                />
              )}
            />
            <Controller
              name="retornarXmlCdr"
              control={control}
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onChange={field.onChange}
                  label="Retornar CDR (XML de respuesta SUNAT)"
                  descripcion="Incluye la URL del CDR (Constancia de Recepción) de SUNAT."
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Formato de impresión</Label>
            <Controller
              name="formatoImpresion"
              control={control}
              render={({ field }) => (
                <RadioFormato value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.formatoImpresion && (
              <p className="text-xs text-[hsl(var(--brand-danger))]">
                {errors.formatoImpresion.message}
              </p>
            )}
          </div>
        </Seccion>

        </div>
        </div>

        {/* ── Acciones ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-end gap-3 pt-2 pb-safe"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || guardar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={guardar.isPending}
            className="min-w-[160px]"
          >
            {guardar.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <FileText className="size-4" />
                Guardar configuración
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </div>
  );
}
