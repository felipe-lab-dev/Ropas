'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, KeyRound, AlertCircle, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { obtener, obtenerPaginado, postear, actualizar, eliminar, mensajeError } from '@/lib/api/client';
import { formatearFecha, formatearNumero } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type ColumnaTabla, type TableState } from '@/components/ui/data-table';
import { usePreferencias } from '@/lib/use-preferencias';
import { BotonConsultaDoc } from '@/components/sunat/boton-consulta-doc';

interface RolLite { id: string; nombre: string }
interface Sucursal { id: string; nombre: string }

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  dni: string | null;
  activo: boolean;
  rolId: string;
  rol: { id: string; nombre: string };
  sucursalDefecto: string | null;
  ultimoIngreso: string | null;
}

const ESTADO_DEFAULT: TableState = { sort: { campo: 'nombre', dir: 'asc' } };
const LIMITE = 30;

export default function UsuariosPage() {
  const [buscar, setBuscar] = React.useState('');
  const [pagina, setPagina] = React.useState(1);
  const [debounced, setDebounced] = React.useState('');
  const [aEliminar, setAEliminar] = React.useState<Usuario | null>(null);
  const [aResetear, setAResetear] = React.useState<Usuario | null>(null);
  const [formAbierto, setFormAbierto] = React.useState(false);
  const [enEdicion, setEnEdicion] = React.useState<Usuario | null>(null);
  const qc = useQueryClient();

  const [estadoTabla, setEstadoTabla] = usePreferencias<TableState>('usuarios', ESTADO_DEFAULT);

  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(buscar); setPagina(1); }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['usuarios', debounced, pagina],
    queryFn: () => obtenerPaginado<Usuario>('/usuarios', {
      limite: LIMITE, pagina, ...(debounced ? { buscar: debounced } : {}),
    }),
    retry: 1,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles-lite'],
    queryFn: () => obtener<RolLite[]>('/roles'),
  });
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => obtener<Sucursal[]>('/sucursales'),
  });

  const sucursalNombre = React.useMemo(() => {
    const m = new Map((sucursales ?? []).map(s => [s.id, s.nombre]));
    return (id: string | null) => (id ? m.get(id) ?? '—' : '—');
  }, [sucursales]);

  const mutarEliminar = useMutation({
    mutationFn: (id: string) => eliminar(`/usuarios/${id}`),
    onSuccess: () => {
      toast.success('Usuario eliminado');
      setAEliminar(null);
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const mutarResetear = useMutation({
    mutationFn: (id: string) => postear<{ passwordTemporal?: string }>(`/usuarios/${id}/resetear-password`, {}),
    onSuccess: r => {
      setAResetear(null);
      if (r?.passwordTemporal) {
        toast.success(`Contraseña temporal: ${r.passwordTemporal}`, { duration: 12_000 });
      } else {
        toast.success('Contraseña restablecida al DNI del usuario');
      }
    },
    onError: e => toast.error(mensajeError(e)),
  });

  const filas = data?.datos ?? [];

  const columnas = React.useMemo<ColumnaTabla<Usuario>[]>(() => [
    {
      id: 'numero', titulo: 'N°', width: 46, minWidth: 40, align: 'right', movible: false,
      render: (_u, idx) => (
        <span className="text-[10px] text-[hsl(var(--text-muted))] tabular-nums">
          {(pagina - 1) * LIMITE + idx + 1}
        </span>
      ),
    },
    {
      id: 'nombre', titulo: 'Usuario', width: 220, minWidth: 160,
      sortValor: u => u.nombre, filter: { tipo: 'texto', getValor: u => u.nombre },
      render: u => (
        <div className="min-w-0">
          <div className="font-semibold truncate">{u.nombre}</div>
          <div className="text-xs text-[hsl(var(--text-muted))] truncate">{u.email}</div>
        </div>
      ),
    },
    {
      id: 'dni', titulo: 'DNI', width: 104, minWidth: 90,
      sortValor: u => u.dni ?? '', filter: { tipo: 'texto', getValor: u => u.dni ?? '' },
      render: u => u.dni ? <span className="font-mono text-xs">{u.dni}</span> : <span className="text-[hsl(var(--text-muted))]">—</span>,
    },
    {
      id: 'rol', titulo: 'Rol', width: 128, minWidth: 100,
      sortValor: u => u.rol.nombre,
      render: u => <Badge variant="default">{u.rol.nombre}</Badge>,
    },
    {
      id: 'sucursal', titulo: 'Sucursal', width: 120, minWidth: 100, colClassName: 'hidden lg:table-cell',
      render: u => <span className="text-sm">{sucursalNombre(u.sucursalDefecto)}</span>,
    },
    {
      id: 'ultimoIngreso', titulo: 'Último ingreso', width: 124, minWidth: 100, align: 'right',
      colClassName: 'hidden xl:table-cell',
      sortValor: u => (u.ultimoIngreso ? new Date(u.ultimoIngreso).getTime() : 0),
      render: u => u.ultimoIngreso
        ? <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums">{formatearFecha(u.ultimoIngreso)}</span>
        : <span className="text-[hsl(var(--text-muted))]">—</span>,
    },
    {
      id: 'estado', titulo: 'Estado', width: 88, minWidth: 76,
      sortValor: u => (u.activo ? 1 : 0),
      filter: {
        tipo: 'select', getValor: u => (u.activo ? 'activos' : 'inactivos'),
        opciones: [{ valor: 'activos', label: 'Activos' }, { valor: 'inactivos', label: 'Inactivos' }],
      },
      render: u => u.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>,
    },
    {
      id: 'acciones', titulo: 'Acciones', width: 116, minWidth: 100, align: 'right', movible: false, cellClassName: 'pr-4',
      render: u => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${u.nombre}`} onClick={() => { setEnEdicion(u); setFormAbierto(true); }}>
            <Edit2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Resetear contraseña de ${u.nombre}`} onClick={() => setAResetear(u)} title="Resetear contraseña">
            <KeyRound className="size-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon-sm" aria-label={`Eliminar ${u.nombre}`} onClick={() => setAEliminar(u)}
            className="text-[hsl(355_75%_65%)] hover:text-[hsl(355_75%_75%)] hover:bg-[hsl(355_75%_55%/0.1)]"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ], [pagina, sucursalNombre]);

  const filtrosActivos = Object.keys(estadoTabla.filtros ?? {}).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Usuarios"
        descripcion="Quién accede al sistema, con qué rol y desde qué sucursal."
        acciones={
          <Button size="lg" onClick={() => { setEnEdicion(null); setFormAbierto(true); }}>
            <Plus className="size-4" /> Nuevo usuario
          </Button>
        }
      />

      <div className="mt-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--text-muted))]" />
            <Input
              data-busqueda
              placeholder="Buscar por nombre, email o DNI…"
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              className="pl-9"
              aria-label="Buscar usuarios"
            />
          </div>
          {filtrosActivos > 0 && (
            <button type="button" onClick={() => setEstadoTabla(p => ({ ...p, filtros: {} }))} className="text-xs text-[hsl(var(--brand-danger))] hover:underline">
              Limpiar {filtrosActivos} filtro{filtrosActivos === 1 ? '' : 's'}
            </button>
          )}
          {data && (
            <span className="text-xs text-[hsl(var(--text-muted))] tabular-nums ml-auto">
              {formatearNumero(data.total)} usuario{data.total === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {isError && (
        <Card className="p-4 border-[hsl(355_75%_55%/0.4)] bg-[hsl(355_75%_55%/0.08)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-[hsl(355_75%_70%)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-[hsl(355_75%_85%)]">No se pudieron cargar los usuarios</div>
              <div className="text-sm text-[hsl(355_75%_75%)] mt-1">{mensajeError(error)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>Reintentar</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {!isError && (
          <DataTable<Usuario>
            columnas={columnas}
            filas={filas}
            getRowKey={u => u.id}
            estado={estadoTabla}
            onEstadoChange={setEstadoTabla}
            cargando={isLoading}
            rowClassName={u => (u.activo ? '' : 'opacity-60')}
            vacioRender={
              <EmptyState
                ilustracion={<UserCog className="size-20 text-[hsl(var(--brand-primary))/60]" />}
                titulo={debounced ? 'Sin resultados' : 'Aún no registraste usuarios'}
                descripcion={debounced ? `No encontramos usuarios que coincidan con "${debounced}".` : 'Creá usuarios y asignales un rol para controlar el acceso al sistema.'}
              />
            }
          />
        )}
        {data && data.total > 0 && (
          <Pagination pagina={data.pagina} totalPaginas={data.totalPaginas} total={data.total} limite={LIMITE} onCambiar={setPagina} />
        )}
      </Card>

      <UsuarioDialog
        abierto={formAbierto}
        usuario={enEdicion}
        roles={roles ?? []}
        sucursales={sucursales ?? []}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={() => { setFormAbierto(false); void qc.invalidateQueries({ queryKey: ['usuarios'] }); }}
      />

      {/* Resetear contraseña */}
      <Dialog open={!!aResetear} onOpenChange={o => !o && setAResetear(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
            <DialogDescription>
              Vas a resetear la contraseña de <strong>{aResetear?.nombre}</strong>.
              {aResetear?.dni
                ? ' La nueva contraseña será su DNI.'
                : ' Como no tiene DNI, se generará una contraseña temporal que se mostrará al confirmar.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAResetear(null)}>Cancelar</Button>
            <Button disabled={mutarResetear.isPending} onClick={() => aResetear && mutarResetear.mutate(aResetear.id)}>
              {mutarResetear.isPending ? 'Reseteando…' : 'Resetear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <Dialog open={!!aEliminar} onOpenChange={o => !o && setAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              Vas a eliminar a <strong>{aEliminar?.nombre}</strong>. Es un borrado lógico:
              el usuario no podrá iniciar sesión, pero su historial se conserva.
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

// ─── Diálogo crear / editar usuario ─────────────────────────────────────────

interface FormState {
  nombre: string; email: string; dni: string; rolId: string;
  sucursalDefecto: string; password: string; activo: boolean;
}

function UsuarioDialog({
  abierto, usuario, roles, sucursales, onCerrar, onGuardado,
}: {
  abierto: boolean;
  usuario: Usuario | null;
  roles: RolLite[];
  sucursales: Sucursal[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esEdicion = !!usuario;
  const [form, setForm] = React.useState<FormState>({
    nombre: '', email: '', dni: '', rolId: '', sucursalDefecto: '', password: '', activo: true,
  });

  React.useEffect(() => {
    if (!abierto) return;
    setForm({
      nombre: usuario?.nombre ?? '',
      email: usuario?.email ?? '',
      dni: usuario?.dni ?? '',
      rolId: usuario?.rolId ?? roles[0]?.id ?? '',
      sucursalDefecto: usuario?.sucursalDefecto ?? '',
      password: '',
      activo: usuario?.activo ?? true,
    });
  }, [abierto, usuario, roles]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const guardar = useMutation({
    mutationFn: async () => {
      const base = {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        dni: form.dni.trim() || null,
        rolId: form.rolId,
        sucursalDefecto: form.sucursalDefecto || null,
      };
      if (esEdicion) {
        return actualizar(`/usuarios/${usuario!.id}`, {
          ...base, activo: form.activo, ...(form.password ? { password: form.password } : {}),
        });
      }
      return postear('/usuarios', {
        ...base, activo: form.activo, ...(form.password ? { password: form.password } : {}),
      });
    },
    onSuccess: () => {
      toast.success(esEdicion ? 'Usuario actualizado' : 'Usuario creado');
      onGuardado();
    },
    onError: e => toast.error(mensajeError(e)),
  });

  function submit() {
    if (form.nombre.trim().length < 2) { toast.error('Nombre requerido (mín. 2 caracteres)'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { toast.error('Email inválido'); return; }
    if (form.dni && !/^\d{8}$/.test(form.dni.trim())) { toast.error('El DNI debe tener 8 dígitos'); return; }
    if (!form.rolId) { toast.error('Seleccioná un rol'); return; }
    if (!esEdicion && !form.password && !form.dni.trim()) {
      toast.error('Definí una contraseña o un DNI (que será la contraseña inicial)');
      return;
    }
    guardar.mutate();
  }

  return (
    <Dialog open={abierto} onOpenChange={o => !o && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {esEdicion ? 'Actualizá los datos del usuario.' : 'El usuario podrá iniciar sesión con su email o DNI.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="u-nombre">Nombre completo *</Label>
            <Input id="u-nombre" data-testid="input-nombre-usuario" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="María García" autoFocus />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-dni">DNI</Label>
              <div className="flex gap-2 items-start">
                <Input id="u-dni" value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="12345678" inputMode="numeric" className="flex-1" />
                <BotonConsultaDoc
                  tipoDocumento="dni"
                  documento={form.dni}
                  testId="btn-consultar-dni-usuario"
                  onDni={d => { set('nombre', d.nombreCompleto); }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email *</Label>
              <Input id="u-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="maria@tienda.com" inputMode="email" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-rol">Rol *</Label>
              <Select id="u-rol" value={form.rolId} onChange={e => set('rolId', e.target.value)}>
                <option value="" disabled>Seleccioná…</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-sucursal">Sucursal por defecto</Label>
              <Select id="u-sucursal" value={form.sucursalDefecto} onChange={e => set('sucursalDefecto', e.target.value)}>
                <option value="">— Ninguna —</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-password">{esEdicion ? 'Nueva contraseña (opcional)' : 'Contraseña'}</Label>
            <Input
              id="u-password" type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder={esEdicion ? 'Dejar vacío para no cambiarla' : 'Dejar vacío = el DNI será la contraseña'}
              autoComplete="new-password"
            />
          </div>

          {esEdicion && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} className="size-4 rounded border-[hsl(var(--border))]" />
              Usuario activo (puede iniciar sesión)
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCerrar} disabled={guardar.isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
