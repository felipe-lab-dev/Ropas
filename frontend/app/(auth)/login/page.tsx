'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Sparkles, User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Sun, Moon,
} from 'lucide-react';
import {
  IconShirt, IconShoe, IconHanger, IconBackpack, IconShirtSport,
  IconSunglasses, IconUmbrella, IconJacket, IconTie, IconSock,
  IconShoppingBag, IconHanger2,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectorTienda } from '@/components/auth/selector-tienda';
import { postear, mensajeError } from '@/lib/api/client';
import { useSesion, type UsuarioSesion } from '@/lib/store/sesion';
import { useApariencia } from '@/lib/store/apariencia';
import {
  obtenerTenantCode,
  setTenantCode,
  tenantEsFijoPorHost,
} from '@/lib/tenant';
import {
  listarTiendas,
  obtenerBranding,
  type BrandingPublico,
  type TiendaResumen,
} from '@/lib/branding';
import { cn } from '@/lib/utils';

const schema = z.object({
  identificador: z.string().min(4, 'Mínimo 4 caracteres'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
});
type FormValues = z.infer<typeof schema>;

interface RespuestaLogin {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioSesion;
}

function saludoHora(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// Iconos de prendas — Tabler Icons (set profesional)
const PRENDA_ICONS = [
  IconShirt, IconShirtSport, IconHanger, IconShoe,
  IconBackpack, IconSunglasses, IconUmbrella, IconJacket,
  IconTie, IconSock, IconShoppingBag, IconHanger2,
];

// Distribución de prendas: posición, tamaño, delay, dirección, opacidad, icon idx
const PRENDAS_FLOTANDO = [
  { top: '8%',  left: '10%', size: 64, icon: 0,  delay: 0,    rev: false, op: 0.22 },
  { top: '24%', left: '76%', size: 52, icon: 2,  delay: -3,   rev: true,  op: 0.18 },
  { top: '55%', left: '12%', size: 72, icon: 1,  delay: -7,   rev: false, op: 0.16 },
  { top: '72%', left: '68%', size: 56, icon: 4,  delay: -10,  rev: true,  op: 0.22 },
  { top: '18%', left: '46%', size: 44, icon: 5,  delay: -5,   rev: false, op: 0.14 },
  { top: '82%', left: '32%', size: 60, icon: 3,  delay: -13,  rev: true,  op: 0.20 },
  { top: '6%',  left: '68%', size: 40, icon: 6,  delay: -15,  rev: false, op: 0.16 },
  { top: '48%', left: '88%', size: 48, icon: 7,  delay: -8,   rev: true,  op: 0.18 },
  { top: '88%', left: '6%',  size: 44, icon: 10, delay: -17,  rev: false, op: 0.14 },
  { top: '36%', left: '32%', size: 36, icon: 8,  delay: -11,  rev: true,  op: 0.12 },
  { top: '64%', left: '50%', size: 40, icon: 9,  delay: -6,   rev: false, op: 0.12 },
  { top: '14%', left: '24%', size: 38, icon: 11, delay: -19,  rev: true,  op: 0.13 },
];

// Sparkles ✨ — pequeñas estrellas brillantes random
const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  top: `${(i * 73 + 7) % 95}%`,
  left: `${(i * 41 + 13) % 95}%`,
  size: 6 + (i % 4) * 3,
  delay: -(i * 0.7) % 5,
}));

export default function LoginPage() {
  const router = useRouter();
  const setSesion = useSesion(s => s.setSesion);
  const tema = useApariencia(s => s.tema);
  const setTema = useApariencia(s => s.setTema);
  const hidratar = useApariencia(s => s.hidratar);
  const [cargando, setCargando] = React.useState(false);
  const [mostrarPwd, setMostrarPwd] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);

  // ── Selección de tienda (estilo Velarde) ────────────────────────────────
  // En localhost/staging el usuario elige la tienda antes de autenticar; en un
  // subdominio real (*.tienda.enkihubs.com) el host la fija y el selector se oculta.
  const [tiendas, setTiendas] = React.useState<TiendaResumen[]>([]);
  const [tiendaSel, setTiendaSel] = React.useState('');
  const [branding, setBranding] = React.useState<BrandingPublico | null>(null);
  const [bloqueado, setBloqueado] = React.useState(true);

  React.useEffect(() => { hidratar(); }, [hidratar]);

  React.useEffect(() => {
    const fijo = tenantEsFijoPorHost();
    setBloqueado(fijo);
    const inicial = obtenerTenantCode();
    setTiendaSel(inicial);
    obtenerBranding(inicial).then(setBranding).catch(() => setBranding(null));
    if (!fijo) {
      listarTiendas().then(setTiendas).catch(() => setTiendas([]));
    }
  }, []);

  const onSelectTienda = (codigo: string) => {
    setTenantCode(codigo);
    setTiendaSel(codigo);
    obtenerBranding(codigo).then(setBranding).catch(() => setBranding(null));
  };

  const nombreTienda = branding?.nombre ?? 'Ropas';
  const subtituloTienda = branding?.subtitulo ?? 'Vende más rápido. Controla tu tienda.';

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const enviar = async (values: FormValues) => {
    setCargando(true);
    try {
      const data = await postear<RespuestaLogin, FormValues>('/auth/login', values);
      setSesion(data);
      toast.success(`Bienvenido, ${data.usuario.nombre}`);
      router.push('/bienvenida');
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  const detectarCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState && e.getModifierState('CapsLock'));
  };

  return (
    <div className="min-h-screen flex bg-[hsl(var(--bg))]">
      {/* ════ Panel izquierdo — Boutique fashion (siempre oscuro/dramático) ════ */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12"
        style={{
          background: `linear-gradient(135deg,
            hsl(265 55% 14%) 0%,
            hsl(275 50% 18%) 50%,
            hsl(295 55% 16%) 100%)`,
        }}
      >
        {/* Mesh gradient morfando — 3 blobs muy grandes que se desplazan */}
        <div
          className="absolute -top-1/4 -left-1/4 w-[60%] h-[60%] rounded-full ropas-mesh-1 pointer-events-none blur-[80px]"
          style={{ background: 'hsl(var(--brand-primary) / 0.65)' }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 w-[65%] h-[65%] rounded-full ropas-mesh-2 pointer-events-none blur-[90px]"
          style={{ background: 'hsl(var(--brand-accent) / 0.45)' }}
        />
        <div
          className="absolute top-1/4 right-1/4 w-[40%] h-[40%] rounded-full ropas-mesh-3 pointer-events-none blur-[70px]"
          style={{ background: 'hsl(var(--brand-primary-hover) / 0.40)' }}
        />

        {/* Capa de oscurecido sutil para legibilidad */}
        <div className="absolute inset-0 bg-[hsl(265_60%_6%)]/25 pointer-events-none" />

        {/* Patrón de costura sutil — líneas dashed animadas */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]">
          <line x1="0" y1="20%" x2="100%" y2="22%" stroke="hsl(var(--brand-accent))" strokeWidth="0.8" className="ropas-stitch" />
          <line x1="0" y1="48%" x2="100%" y2="46%" stroke="hsl(var(--brand-accent))" strokeWidth="0.8" className="ropas-stitch" style={{ animationDelay: '-0.4s' }} />
          <line x1="0" y1="78%" x2="100%" y2="80%" stroke="hsl(var(--brand-accent))" strokeWidth="0.8" className="ropas-stitch" style={{ animationDelay: '-0.8s' }} />
        </svg>

        {/* Iconos de prendas flotantes — Tabler Icons */}
        {PRENDAS_FLOTANDO.map((p, i) => {
          const Icon = PRENDA_ICONS[p.icon]!;
          return (
            <div
              key={i}
              className={`absolute pointer-events-none ${p.rev ? 'ropas-prenda-rev' : 'ropas-prenda'}`}
              style={{
                top: p.top,
                left: p.left,
                animationDelay: `${p.delay}s`,
                ['--max-opacity' as string]: p.op,
                color: 'hsl(var(--brand-accent))',
                filter: `drop-shadow(0 0 12px hsl(var(--brand-accent) / 0.5))`,
              }}
            >
              <Icon size={p.size} strokeWidth={1.4} />
            </div>
          );
        })}

        {/* Sparkles ✨ randomly twinkling */}
        {SPARKLES.map((s, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className="absolute pointer-events-none ropas-sparkle"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              filter: 'drop-shadow(0 0 6px hsl(var(--brand-accent) / 0.8))',
            }}
            fill="hsl(var(--brand-accent))"
          >
            <path d="M12 0 L13.5 9 L22 10.5 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
          </svg>
        ))}

        {/* Contenido centrado */}
        <div className="relative z-10 text-center max-w-md">
          {/* Logo con anillo rotativo gradient */}
          <div className="flex justify-center mb-8 login-reveal-up" style={{ animationDelay: '0.1s' }}>
            <div className="relative size-32 grid place-items-center">
              {/* Anillo rotativo */}
              <div className="absolute inset-0 rounded-full ropas-ring-rotate"
                style={{
                  background: `conic-gradient(from 0deg,
                    hsl(var(--brand-primary)) 0%,
                    transparent 30%,
                    hsl(var(--brand-accent)) 50%,
                    transparent 80%,
                    hsl(var(--brand-primary)) 100%)`,
                  mask: 'radial-gradient(circle, transparent 56px, black 58px)',
                  WebkitMask: 'radial-gradient(circle, transparent 56px, black 58px)',
                }}
              />
              {/* Halo blur */}
              <div className="absolute size-24 rounded-3xl blur-2xl opacity-70 gradient-brand-accent" />
              {/* Núcleo logo */}
              <div className="relative size-24 rounded-3xl gradient-brand-accent grid place-items-center shadow-[0_8px_32px_hsl(var(--brand-primary)/0.5)]">
                <Sparkles className="size-10 text-white" />
              </div>
            </div>
          </div>

          {/* Títulos con reveal */}
          <h1
            className="text-5xl font-black text-white mb-3 tracking-tight login-reveal-up"
            style={{ animationDelay: '0.2s' }}
          >
            {nombreTienda}
          </h1>
          <p
            className="text-xl font-semibold mb-3 login-reveal-up bg-gradient-to-r from-[hsl(var(--brand-accent))] via-white to-[hsl(var(--brand-primary))] bg-clip-text text-transparent"
            style={{ animationDelay: '0.35s' }}
          >
            {subtituloTienda}
          </p>
          <p
            className="text-sm leading-relaxed text-white/65 max-w-sm mx-auto login-reveal-up"
            style={{ animationDelay: '0.5s' }}
          >
            ERP para tienda de ropa. Variantes, inventario multi-sucursal,
            POS y reportes — todo en uno, sin pelearle al sistema.
          </p>

          {/* Shimmer separator */}
          <div className="mt-8 mb-8 h-px w-full login-shimmer-bar rounded-full" />

          {/* Stats con entrada escalonada */}
          <div className="flex justify-center gap-6 text-white/55">
            <div className="text-center login-stat-in-1">
              <p className="text-2xl font-bold text-[hsl(var(--brand-accent))]">7+</p>
              <p className="text-[10px] uppercase tracking-wider">Paletas</p>
            </div>
            <div className="w-px bg-white/15 login-stat-in-1" />
            <div className="text-center login-stat-in-2">
              <p className="text-2xl font-bold text-[hsl(var(--brand-accent))]">24/7</p>
              <p className="text-[10px] uppercase tracking-wider">Operación</p>
            </div>
            <div className="w-px bg-white/15 login-stat-in-2" />
            <div className="text-center login-stat-in-3">
              <p className="text-2xl font-bold text-[hsl(var(--brand-accent))]">100%</p>
              <p className="text-[10px] uppercase tracking-wider">En la nube</p>
            </div>
          </div>
        </div>
      </div>

      {/* ════ Panel derecho — Formulario ════ */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Decoración sutil de fondo */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 login-float-2"
          style={{ background: 'hsl(var(--brand-primary) / 0.05)', animationDuration: '25s' }}
        />
        <div
          className="absolute bottom-0 left-0 w-72 h-72 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 login-float-3"
          style={{ background: 'hsl(var(--brand-accent) / 0.05)', animationDuration: '22s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full login-pulse-glow"
          style={{ background: 'hsl(var(--brand-primary) / 0.04)', animationDuration: '6s' }}
        />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="size-16 mx-auto mb-4 rounded-2xl gradient-brand-accent grid place-items-center shadow-[0_8px_24px_hsl(var(--brand-primary)/0.4)]">
              <Sparkles className="size-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{nombreTienda}</h1>
          </div>

          {/* Card con borde gradient animado */}
          <div className="login-gradient-border">
            <div className="rounded-2xl bg-[hsl(var(--surface))] p-8 shadow-[0_20px_60px_-15px_hsl(265_50%_4%/0.4)]">
              <div className="mb-7">
                <h2 className="text-2xl font-bold tracking-tight">{saludoHora()}</h2>
                <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
                  Ingresa tus credenciales para acceder al ERP.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(enviar)} className="space-y-5">
                {/* Tienda — solo en localhost/staging; en subdominio real el host la fija */}
                {!bloqueado && tiendas.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="tienda">Tienda</Label>
                    <SelectorTienda
                      id="tienda"
                      value={tiendaSel}
                      onChange={onSelectTienda}
                      tiendas={tiendas}
                      nombreActual={branding?.nombre}
                      disabled={cargando}
                    />
                  </div>
                )}

                {/* Usuario / DNI */}
                <div className="space-y-1.5">
                  <Label htmlFor="identificador">DNI o Email</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
                    <Input
                      id="identificador"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      placeholder="70498300 o usuario@dominio.com"
                      className="pl-10 login-input-focus"
                      {...form.register('identificador')}
                    />
                  </div>
                  {form.formState.errors.identificador && (
                    <p className="text-xs text-[hsl(var(--brand-danger))] flex items-center gap-1 animate-slide-up">
                      <AlertCircle className="size-3" />
                      {form.formState.errors.identificador.message}
                    </p>
                  )}
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
                    <Input
                      id="password"
                      type={mostrarPwd ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Tu contraseña"
                      className="pl-10 pr-11 login-input-focus"
                      onKeyDown={detectarCaps}
                      onKeyUp={detectarCaps}
                      {...form.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text))] transition-colors"
                      aria-label={mostrarPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {mostrarPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {capsLock && (
                    <p className="text-xs text-[hsl(var(--brand-warning))] flex items-center gap-1 animate-fade-in">
                      <AlertCircle className="size-3" />
                      Bloq Mayús activado
                    </p>
                  )}
                  {form.formState.errors.password && (
                    <p className="text-xs text-[hsl(var(--brand-danger))] flex items-center gap-1 animate-slide-up">
                      <AlertCircle className="size-3" />
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full h-12 rounded-lg gradient-brand text-white font-semibold text-base
                             shadow-[0_8px_20px_-6px_hsl(var(--brand-primary)/0.45)]
                             hover:shadow-[0_12px_28px_-6px_hsl(var(--brand-primary)/0.6)]
                             hover:scale-[1.02] active:scale-[0.98]
                             transition-all duration-300 grid place-items-center
                             disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  {cargando ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verificando…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Iniciar sesión <ArrowRight className="size-4" />
                    </span>
                  )}
                </button>
              </form>

              <p className="text-center text-[11px] text-[hsl(var(--text-muted))]/70 mt-4 select-none">
                Presiona{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--surface-2))] text-[10px] font-mono border border-[hsl(var(--border))]">
                  Enter
                </kbd>{' '}
                para iniciar
              </p>
            </div>
          </div>

          {/* Footer: toggle tema + versión */}
          <div
            className="flex items-center justify-center gap-3 mt-6 login-reveal-up"
            style={{ animationDelay: '0.6s' }}
          >
            <span className="text-[11px] text-[hsl(var(--text-muted))]">© 2026 Ropas</span>
            <span className="text-[hsl(var(--border))]">|</span>
            <button
              onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--text-muted))] hover:text-[hsl(var(--brand-primary))] transition-colors"
            >
              {tema === 'dark' ? (
                <>
                  <Sun className="size-4 login-spin-sun text-[hsl(var(--brand-accent))]" />
                  <span>Modo claro</span>
                </>
              ) : (
                <>
                  <Moon className="size-4 login-rock-moon" />
                  <span>Modo oscuro</span>
                </>
              )}
            </button>
            <span className="text-[hsl(var(--border))]">|</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--brand-primary))] font-semibold tracking-wide">
              v1.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
