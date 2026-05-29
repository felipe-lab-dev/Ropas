'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, Plus, Save, Trash2, Lock, Users as UsersIcon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { obtener, postear, actualizar, eliminar, mensajeError } from '@/lib/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

interface Rol {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  esSistema: boolean;
  usuariosCount: number;
  esTotal: boolean;
}
interface AccionPermiso { codigo: string; label: string }
interface ModuloPermiso { modulo: string; label: string; acciones: AccionPermiso[] }

export default function AccesosPage() {
  const qc = useQueryClient();
  const [rolSelId, setRolSelId] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [crearAbierto, setCrearAbierto] = React.useState(false);
  const [aEliminar, setAEliminar] = React.useState<Rol | null>(null);

  const { data: roles, isLoading: cargandoRoles, isError, error, refetch } = useQuery({
    queryKey: ['roles'],
    queryFn: () => obtener<Rol[]>('/roles'),
    retry: 1,
  });

  const { data: catalogo } = useQuery({
    queryKey: ['catalogo-permisos'],
    queryFn: () => obtener<ModuloPermiso[]>('/roles/catalogo-permisos'),
  });

  // Seleccionar el primer rol al cargar.
  React.useEffect(() => {
    const primero = roles?.[0];
    if (!rolSelId && primero) setRolSelId(primero.id);
  }, [roles, rolSelId]);

  const rolSel = React.useMemo(() => roles?.find(r => r.id === rolSelId) ?? null, [roles, rolSelId]);

  // Sincronizar el set editable cuando cambia el rol seleccionado.
  React.useEffect(() => {
    setSel(new Set(rolSel?.permisos ?? []));
  }, [rolSel]);

  const soloLectura = !!rolSel && (rolSel.esSistema || rolSel.esTotal);
  const dirty = React.useMemo(() => {
    if (!rolSel) return false;
    const orig = new Set(rolSel.permisos);
    if (orig.size !== sel.size) return true;
    for (const p of sel) if (!orig.has(p)) return true;
    return false;
  }, [rolSel, sel]);

  const guardar = useMutation({
    mutationFn: () => actualizar(`/roles/${rolSel!.id}`, { permisos: Array.from(sel) }),
    onSuccess: () => {
      toast.success('Permisos actualizados');
      void qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const mutarEliminar = useMutation({
    mutationFn: (id: string) => eliminar(`/roles/${id}`),
    onSuccess: (_d, id) => {
      toast.success('Rol eliminado');
      setAEliminar(null);
      if (rolSelId === id) setRolSelId(null);
      void qc.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  function togglePermiso(codigo: string) {
    if (soloLectura) return;
    setSel(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo); else next.add(codigo);
      return next;
    });
  }

  function toggleModulo(mod: ModuloPermiso, activar: boolean) {
    if (soloLectura) return;
    setSel(prev => {
      const next = new Set(prev);
      for (const a of mod.acciones) { if (activar) next.add(a.codigo); else next.delete(a.codigo); }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Accesos"
        descripcion="Definí roles y qué puede hacer cada uno. Asigná el rol a cada persona en Usuarios."
        acciones={
          <Button size="lg" onClick={() => setCrearAbierto(true)}>
            <Plus className="size-4" /> Nuevo rol
          </Button>
        }
      />

      {isError && (
        <Card className="p-4 border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-[hsl(355_75%_85%)]">No se pudieron cargar los roles</div>
              <div className="text-sm text-[hsl(355_75%_75%)] mt-1">{mensajeError(error)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Reintentar</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Lista de roles */}
        <Card className="p-2 h-max">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--text-muted))]">
            Roles
          </div>
          <div className="flex flex-col gap-1">
            {cargandoRoles && <div className="p-3 text-sm text-[hsl(var(--text-muted))]">Cargando…</div>}
            {roles?.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRolSelId(r.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg transition-colors',
                  r.id === rolSelId ? 'bg-[hsl(var(--brand-primary))]/12 text-[hsl(var(--text))]' : 'hover:bg-[hsl(var(--surface-2))]/60',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {r.esTotal ? <ShieldCheck className="size-4 text-[hsl(var(--brand-primary))] shrink-0" /> : <ShieldCheck className="size-4 text-[hsl(var(--text-muted))] shrink-0" />}
                  <span className="font-medium truncate flex-1">{r.nombre}</span>
                  {r.esSistema && <Lock className="size-3 text-[hsl(var(--text-muted))] shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5 pl-6 text-[10px] text-[hsl(var(--text-muted))]">
                  <span className="inline-flex items-center gap-1"><UsersIcon className="size-3" />{r.usuariosCount}</span>
                  <span>·</span>
                  <span>{r.esTotal ? 'Acceso total' : `${r.permisos.length} permisos`}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Matriz de permisos */}
        <Card className="p-0 overflow-hidden">
          {!rolSel ? (
            <div className="p-10 text-center text-sm text-[hsl(var(--text-muted))]">Seleccioná un rol para ver sus permisos.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-[hsl(var(--border))]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold truncate">{rolSel.nombre}</h2>
                    {rolSel.esSistema && <Badge variant="outline">Sistema</Badge>}
                  </div>
                  {rolSel.descripcion && <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">{rolSel.descripcion}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!rolSel.esSistema && (
                    <Button
                      variant="ghost" size="sm"
                      className="text-[hsl(355_75%_65%)] hover:text-[hsl(355_75%_75%)] hover:bg-[hsl(355_75%_55%/0.1)]"
                      onClick={() => setAEliminar(rolSel)}
                    >
                      <Trash2 className="size-3.5" /> Eliminar rol
                    </Button>
                  )}
                  {!soloLectura && (
                    <Button size="sm" disabled={!dirty || guardar.isPending} onClick={() => guardar.mutate()}>
                      <Save className="size-3.5" /> {guardar.isPending ? 'Guardando…' : 'Guardar'}
                    </Button>
                  )}
                </div>
              </div>

              {soloLectura ? (
                <div className="p-6 flex items-start gap-3">
                  <ShieldCheck className="size-5 text-[hsl(var(--brand-primary))] shrink-0 mt-0.5" />
                  <div className="text-sm text-[hsl(var(--text-muted))]">
                    <span className="font-medium text-[hsl(var(--text))]">Acceso total.</span> Este rol del sistema puede hacer
                    todo y no se edita. Si necesitás un rol con permisos acotados, creá uno nuevo.
                  </div>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {catalogo?.map(mod => {
                    const total = mod.acciones.length;
                    const activos = mod.acciones.filter(a => sel.has(a.codigo)).length;
                    const todos = activos === total;
                    return (
                      <div key={mod.modulo} className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleModulo(mod, !todos)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[hsl(var(--surface-2))]/40 hover:bg-[hsl(var(--surface-2))]/70 transition-colors"
                        >
                          <span className="font-semibold text-sm">{mod.label}</span>
                          <span className={cn(
                            'text-[10px] tabular-nums px-1.5 py-0.5 rounded',
                            activos === 0 ? 'text-[hsl(var(--text-muted))]' : todos ? 'text-[hsl(var(--brand-success))] bg-[hsl(var(--brand-success))]/12' : 'text-[hsl(35_90%_55%)] bg-[hsl(35_90%_55%)]/12',
                          )}>
                            {activos}/{total}
                          </span>
                        </button>
                        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {mod.acciones.map(a => (
                            <label key={a.codigo} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[hsl(var(--surface-2))]/40 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={sel.has(a.codigo)}
                                onChange={() => togglePermiso(a.codigo)}
                                className="size-4 rounded border-[hsl(var(--border))] shrink-0"
                              />
                              <span className="truncate" title={a.codigo}>{a.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <CrearRolDialog
        abierto={crearAbierto}
        onCerrar={() => setCrearAbierto(false)}
        onCreado={id => { setCrearAbierto(false); setRolSelId(id); void qc.invalidateQueries({ queryKey: ['roles'] }); }}
      />

      <Dialog open={!!aEliminar} onOpenChange={o => !o && setAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar rol</DialogTitle>
            <DialogDescription>
              Vas a eliminar el rol <strong>{aEliminar?.nombre}</strong>. Si tiene usuarios asignados,
              el sistema bloqueará el borrado (reasignalos primero).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAEliminar(null)}>Cancelar</Button>
            <Button variant="danger" disabled={mutarEliminar.isPending} onClick={() => aEliminar && mutarEliminar.mutate(aEliminar.id)}>
              {mutarEliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CrearRolDialog({ abierto, onCerrar, onCreado }: { abierto: boolean; onCerrar: () => void; onCreado: (id: string) => void }) {
  const [nombre, setNombre] = React.useState('');
  const [descripcion, setDescripcion] = React.useState('');

  React.useEffect(() => { if (abierto) { setNombre(''); setDescripcion(''); } }, [abierto]);

  const crear = useMutation({
    mutationFn: () => postear<{ id: string }>('/roles', { nombre: nombre.trim(), descripcion: descripcion.trim() || null, permisos: [] }),
    onSuccess: rol => { toast.success('Rol creado'); onCreado(rol.id); },
    onError: e => toast.error(mensajeError(e)),
  });

  return (
    <Dialog open={abierto} onOpenChange={o => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo rol</DialogTitle>
          <DialogDescription>Creá el rol y luego marcá sus permisos en la matriz.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-nombre">Nombre *</Label>
            <Input id="r-nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Vendedor, Cajero, Supervisor…" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-desc">Descripción</Label>
            <Textarea id="r-desc" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} placeholder="Qué hace este rol…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={crear.isPending}>Cancelar</Button>
          <Button onClick={() => { if (nombre.trim().length < 2) { toast.error('Nombre requerido'); return; } crear.mutate(); }} disabled={crear.isPending}>
            {crear.isPending ? 'Creando…' : 'Crear rol'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
