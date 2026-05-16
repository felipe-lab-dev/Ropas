'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { postear, mensajeError } from '@/lib/api/client';
import { useSesion, type UsuarioSesion } from '@/lib/store/sesion';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
});
type FormValues = z.infer<typeof schema>;

interface RespuestaLogin {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioSesion;
}

export default function LoginPage() {
  const router = useRouter();
  const setSesion = useSesion(s => s.setSesion);
  const [cargando, setCargando] = React.useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const enviar = async (values: FormValues) => {
    setCargando(true);
    try {
      const data = await postear<RespuestaLogin, FormValues>('/auth/login', values);
      setSesion(data);
      toast.success(`Bienvenido, ${data.usuario.nombre}`);
      router.push('/dashboard');
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[hsl(var(--bg))] text-[hsl(var(--text))]">
      <div className="relative hidden lg:flex items-end p-12 grid-pattern overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(var(--brand-primary))]/30 via-transparent to-[hsl(var(--brand-accent))]/20" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-lg"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="size-10 rounded-lg bg-gradient-to-br from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] grid place-items-center">
              <Sparkles className="size-5 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight">Ropas</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter mb-4 text-balance">
            Vendé más rápido.
            <br />
            <span className="bg-gradient-to-r from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-accent))] bg-clip-text text-transparent">
              Controlá tu tienda.
            </span>
          </h1>
          <p className="text-[hsl(var(--text-muted))] text-lg">
            ERP brutal para tiendas de ropa. Variantes, inventario multi-sucursal, POS, reportes — todo en uno.
          </p>
        </motion.div>
      </div>

      <div className="flex items-center justify-center p-8">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={form.handleSubmit(enviar)}
          className="w-full max-w-sm space-y-6"
        >
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Iniciar sesión</h2>
            <p className="text-sm text-[hsl(var(--text-muted))]">
              Accedé al ERP de tu tienda.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-[hsl(var(--brand-danger))]">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
              {form.formState.errors.password && (
                <p className="text-xs text-[hsl(var(--brand-danger))]">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={cargando}>
            {cargando ? 'Ingresando…' : (
              <>Entrar <ArrowRight className="size-4" /></>
            )}
          </Button>
        </motion.form>
      </div>
    </div>
  );
}
