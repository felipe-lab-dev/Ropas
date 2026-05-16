'use client';

import { motion } from 'framer-motion';
import { useApariencia } from '@/lib/store/apariencia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

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
  const fontSize = useApariencia(s => s.fontSize);
  const setFontSize = useApariencia(s => s.setFontSize);
  const familia = useApariencia(s => s.familiaFuente);
  const setFamilia = useApariencia(s => s.setFamiliaFuente);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-[hsl(var(--text-muted))]">Personalizá la apariencia y los datos del negocio.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Modo</Label>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {(['light', 'dark'] as const).map(t => (
                <motion.button
                  key={t}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setTema(t)}
                  className={`p-4 rounded-md border-2 text-sm font-medium transition-all capitalize ${
                    tema === t
                      ? 'border-[hsl(var(--brand-primary))] bg-[hsl(var(--brand-primary))]/10'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--brand-primary))]/40'
                  }`}
                >
                  {t === 'dark' ? 'Oscuro' : 'Claro'}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
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

          <div className="space-y-2">
            <Label>Familia tipográfica</Label>
            <select
              value={familia}
              onChange={e => setFamilia(e.target.value)}
              className="w-full max-w-sm h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 text-sm"
            >
              {FUENTES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <p className="text-xs text-[hsl(var(--text-muted))]">
              Recordá que algunas fuentes deben cargarse desde el layout para verse correctamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
