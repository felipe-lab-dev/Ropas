'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, RotateCcw, Sparkles, Upload, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useApariencia, PALETAS, type Paleta } from '@/lib/store/apariencia';
import { DEFAULT_LOGO_SVG } from '@/lib/default-logo-svg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Logo3D } from '@/components/bienvenida/logo-3d';
import { mensajeError } from '@/lib/api/client';
import { guardarBranding, type GuardarBrandingInput } from '@/lib/branding';

const FUENTES = [
  { value: '', label: 'Geist (default)' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Space Grotesk, sans-serif', label: 'Space Grotesk' },
  { value: 'Plus Jakarta Sans, sans-serif', label: 'Plus Jakarta Sans' },
  { value: 'IBM Plex Sans, sans-serif', label: 'IBM Plex Sans' },
];

export default function ConfiguracionPage() {
  const tema = useApariencia(s => s.tema);
  const setTema = useApariencia(s => s.setTema);
  const paleta = useApariencia(s => s.paleta);
  const setPaleta = useApariencia(s => s.setPaleta);
  const fontSize = useApariencia(s => s.fontSize);
  const setFontSize = useApariencia(s => s.setFontSize);
  const familia = useApariencia(s => s.familiaFuente);
  const setFamilia = useApariencia(s => s.setFamiliaFuente);
  const logoSvg = useApariencia(s => s.logoSvg);
  const setLogoSvg = useApariencia(s => s.setLogoSvg);
  const nombreApp = useApariencia(s => s.nombreApp);
  const setNombreApp = useApariencia(s => s.setNombreApp);
  const subtituloApp = useApariencia(s => s.subtituloApp);
  const setSubtituloApp = useApariencia(s => s.setSubtituloApp);
  const [svgBorrador, setSvgBorrador] = React.useState(logoSvg);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { setSvgBorrador(logoSvg); }, [logoSvg]);

  // Toast "Preferencias guardadas" para los ajustes por-navegador (tema/paleta/
  // tamaño/fuente). La identidad de la tienda (logo/nombre/eslogan) tiene su propio
  // feedback porque se persiste en el servidor (DB compartida → refleja en prod).
  const primerRender = React.useRef(true);
  React.useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    const t = setTimeout(() => {
      toast.success('Preferencias guardadas', { duration: 1400, id: 'config-saved' });
    }, 350);
    return () => clearTimeout(t);
  }, [tema, paleta, fontSize, familia]);

  // Persiste el logo SVG en la tienda (public.tenants.branding). Como la DB es
  // compartida dev/prod, editar acá se refleja en producción al instante.
  const persistirLogo = useMutation({
    mutationFn: (svg: string) => guardarBranding({ logoSvg: svg }),
    onSuccess: () => toast.success('Logo guardado — se refleja en producción', { id: 'logo-saved' }),
    onError: err => toast.error(mensajeError(err)),
  });

  // Persistencia debounced de nombre + eslogan (no toastea: lo cubre el aviso local).
  const persistirIdentidad = useMutation({
    mutationFn: (input: GuardarBrandingInput) => guardarBranding(input),
    onError: err => toast.error(mensajeError(err)),
  });
  const pendienteRef = React.useRef<GuardarBrandingInput>({});
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const agendarGuardado = (parcial: GuardarBrandingInput) => {
    pendienteRef.current = { ...pendienteRef.current, ...parcial };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const payload = pendienteRef.current;
      pendienteRef.current = {};
      persistirIdentidad.mutate(payload);
    }, 700);
  };

  // Aplica el SVG localmente (preview 3D instantáneo) y opcionalmente lo persiste.
  const aplicarLogo = (texto: string, persistir: boolean) => {
    setLogoSvg(texto);
    setSvgBorrador(texto);
    if (persistir) persistirLogo.mutate(texto);
  };

  const onArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.includes('svg') && !f.name.endsWith('.svg')) {
      toast.error('Solo se aceptan archivos .svg');
      return;
    }
    let texto = '';
    try {
      texto = await f.text();
    } catch {
      toast.error('No se pudo leer el archivo');
      return;
    }
    if (!texto.includes('<svg')) {
      toast.error('El archivo no parece un SVG válido');
      return;
    }
    // Preview 3D al instante (sin esperar al backend) + persiste en la tienda.
    aplicarLogo(texto, true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Configuración"
        descripcion="Personaliza la apariencia y los datos del negocio."
      />

      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-xl border border-[hsl(var(--brand-primary))]/25 bg-[hsl(var(--brand-primary))]/8 px-4 py-3"
      >
        <div className="size-8 rounded-lg bg-[hsl(var(--brand-primary))]/15 text-[hsl(var(--brand-primary))] grid place-items-center shrink-0">
          <Zap className="size-4" />
        </div>
        <div className="text-sm">
          <div className="font-semibold">Tus cambios se guardan al instante</div>
          <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
            La <strong>identidad de la tienda</strong> (logo, nombre y eslogan) se guarda en la
            tienda y <strong>se refleja en producción</strong>. El tema, la paleta y la fuente son
            preferencias de este navegador.
          </p>
        </div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-7">
          {/* Modo claro/oscuro */}
          <div className="space-y-2.5">
            <Label>Modo</Label>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {(['light', 'dark'] as const).map(t => (
                <motion.button
                  key={t}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setTema(t)}
                  className={`p-4 rounded-lg border-2 text-sm font-medium transition-all capitalize ${
                    tema === t
                      ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40'
                  }`}
                >
                  {t === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Paleta de colores */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <Label>Paleta de color</Label>
              <span className="text-xs text-[hsl(var(--text-muted))]">
                {PALETAS.find(p => p.id === paleta)?.nombre}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {PALETAS.map(p => (
                <SwatchPaleta
                  key={p.id}
                  paleta={p}
                  activo={paleta === p.id}
                  onClick={() => setPaleta(p.id)}
                />
              ))}
            </div>
          </div>

          {/* Tamaño de fuente */}
          <div className="space-y-2.5">
            <Label>Tamaño de fuente base ({fontSize}px)</Label>
            <input
              type="range"
              min={12}
              max={18}
              value={fontSize}
              onChange={e => setFontSize(parseInt(e.target.value, 10))}
              className="w-full max-w-sm accent-[hsl(var(--brand-primary))]"
            />
          </div>

          {/* Tipografía */}
          <div className="space-y-2.5">
            <Label>Familia tipográfica</Label>
            <select
              value={familia}
              onChange={e => setFamilia(e.target.value)}
              className="w-full max-w-sm h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3.5 text-sm focus:outline-none focus:border-[hsl(var(--brand-primary))]/60 focus:ring-[3px] focus:ring-[hsl(var(--brand-primary))]/15 transition-all"
            >
              {FUENTES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <p className="text-xs text-[hsl(var(--text-muted))]">
              Algunas fuentes requieren cargarse desde el layout para renderizarse correctamente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Identidad de la app — logo 3D editable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-[hsl(var(--brand-primary))]" />
            Identidad de la tienda
          </CardTitle>
          <p className="text-xs text-[hsl(var(--text-muted))]">
            Estos datos aparecen en la pantalla de Inicio, en el login, en el header
            y en los cupones (PDF/PNG generados).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombreApp">Nombre de la tienda</Label>
              <Input
                id="nombreApp"
                value={nombreApp}
                onChange={e => { setNombreApp(e.target.value); agendarGuardado({ nombre: e.target.value }); }}
                placeholder="Ropas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subtituloApp">Eslogan / subtítulo</Label>
              <Input
                id="subtituloApp"
                value={subtituloApp}
                onChange={e => { setSubtituloApp(e.target.value); agendarGuardado({ subtitulo: e.target.value }); }}
                placeholder="Vende más rápido. Controla tu tienda."
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Logo SVG (texto 3D de bienvenida)</Label>
              <button
                onClick={() => aplicarLogo(DEFAULT_LOGO_SVG, true)}
                className="text-xs text-[hsl(var(--brand-primary))] hover:underline flex items-center gap-1"
              >
                <RotateCcw className="size-3" />
                Restaurar default
              </button>
            </div>

            {/* Dropzone / file picker */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={persistirLogo.isPending}
              className="w-full rounded-xl border-2 border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/60 hover:bg-[hsl(var(--brand-primary))]/5 transition-all p-6 flex flex-col items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="size-12 rounded-xl bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--brand-primary))] grid place-items-center group-hover:scale-110 transition-transform">
                {persistirLogo.isPending ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
              </div>
              <div className="text-sm font-semibold">
                {persistirLogo.isPending ? 'Guardando…' : 'Subir archivo SVG'}
              </div>
              <p className="text-xs text-[hsl(var(--text-muted))] text-center max-w-md">
                Solo <code className="text-[10px]">.svg</code> con paths (sin <code className="text-[10px]">&lt;text&gt;</code>).
                El preview 3D se actualiza al instante y el logo se guarda en la tienda
                (<strong>se refleja en producción</strong>).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                onChange={onArchivo}
                className="hidden"
              />
            </button>

            {/* O editar manualmente */}
            <details className="rounded-lg border border-[hsl(var(--border))]">
              <summary className="cursor-pointer text-xs font-semibold px-3 py-2 hover:bg-[hsl(var(--surface-2))]/50">
                ✏️ O editar SVG manualmente (avanzado)
              </summary>
              <div className="p-3 space-y-2 border-t border-[hsl(var(--border))]">
                <textarea
                  value={svgBorrador}
                  onChange={e => setSvgBorrador(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className="w-full font-mono text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))]/40 px-3 py-2 focus:outline-none focus:border-[hsl(var(--brand-primary))]/60 focus:ring-[3px] focus:ring-[hsl(var(--brand-primary))]/15 transition-all resize-y scrollbar-thin"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))] flex-1 min-w-[180px]">
                    Tip: <code>maxX ≤ 520</code> = primario · <code>minY {'<'} 65</code> = texto · resto = acento.
                    «Aplicar local» solo previsualiza; «Guardar en la tienda» lo persiste (refleja en prod).
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!svgBorrador.includes('<svg')) {
                          toast.error('No parece un SVG válido');
                          return;
                        }
                        aplicarLogo(svgBorrador, false);
                        toast.success('Logo aplicado localmente');
                      }}
                    >
                      Aplicar local
                    </Button>
                    <Button
                      size="sm"
                      disabled={persistirLogo.isPending}
                      onClick={() => {
                        if (!svgBorrador.includes('<svg')) {
                          toast.error('No parece un SVG válido');
                          return;
                        }
                        aplicarLogo(svgBorrador, true);
                      }}
                    >
                      Guardar en la tienda
                    </Button>
                  </div>
                </div>
              </div>
            </details>

            {/* Preview 3D */}
            <div className="rounded-xl border border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--surface))] to-[hsl(var(--surface-2))]/50 overflow-hidden">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[hsl(var(--text-muted))] px-3 py-2 border-b border-[hsl(var(--border))] flex items-center justify-between">
                <span>Vista previa 3D</span>
                <span className="text-[hsl(var(--brand-primary))]">↓ pasa el mouse para rotar</span>
              </div>
              <Logo3D className="h-56" />
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function SwatchPaleta({
  paleta,
  activo,
  onClick,
}: {
  paleta: { id: Paleta; nombre: string; preview: [string, string] };
  activo: boolean;
  onClick: () => void;
}) {
  const [c1, c2] = paleta.preview;
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`group relative p-3 rounded-xl border-2 text-left transition-all ${
        activo
          ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/8'
          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block size-7 rounded-lg shadow-sm shrink-0"
          style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
        />
        <span className="text-sm font-medium truncate">{paleta.nombre}</span>
        {activo && (
          <motion.span
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            className="ml-auto size-5 rounded-full bg-[hsl(var(--brand-primary))] text-white grid place-items-center shrink-0"
          >
            <Check className="size-3" />
          </motion.span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="h-1.5 flex-1 rounded-full" style={{ background: c1 }} />
        <span className="h-1.5 flex-1 rounded-full" style={{ background: c2 }} />
      </div>
    </motion.button>
  );
}
