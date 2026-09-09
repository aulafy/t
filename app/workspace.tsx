'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  ArrowUpRight,
  Check,
  Clock,
  FileText,
  Download,
  Building2,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { formatEuro, parseEuroInput } from '@/lib/domain/money.mjs';
import { calculateTotal } from '@/lib/domain/change.mjs';
type Row = Record<string, any>;
const labels: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  executed: 'Ejecutado',
  paid: 'Cobrado',
  void: 'Anulado',
};
const blank = {
  title: '',
  description: '',
  base: '',
  taxBasisPoints: 2100,
  days: 0,
};
async function request(path: string, data?: Row) {
  const r = await fetch(path, {
    method: data ? 'POST' : 'GET',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const b: any = await r.json();
  if (!r.ok) throw new Error(b.error || 'No se pudo completar la operación.');
  return b;
}
export default function Workspace({ userName }: { userName: string }) {
  const [data, setData] = useState<{
    projects: Row[];
    changes: Row[];
    events: Row[];
  }>({ projects: [], changes: [], events: [] });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [projectId, setProjectId] = useState(''),
    [changeId, setChangeId] = useState('');
  const [newProject, setNewProject] = useState(false),
    [projectForm, setProjectForm] = useState({
      name: '',
      client: '',
      budget: '',
    });
  const [editLock, setEditLock] = useState(0);
  const [form, setForm] = useState(blank),
    [reviewed, setReviewed] = useState(false),
    [share, setShare] = useState('');
  const load = useCallback(async () => {
    const d = await request('/api/workspace');
    setData(d);
    setProjectId((prev) => prev || d.projects[0]?.id || '');
  }, []);
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  const project = data.projects.find((p) => p.id === projectId),
    changes = data.changes.filter((c) => c.project_id === projectId),
    selected = changes.find((c) => c.id === changeId);
  const approved = changes
    .filter((c) => ['approved', 'executed', 'paid'].includes(c.status))
    .reduce((n, c) => n + c.total_cents, 0);
  const pending = changes.filter((c) => c.status === 'sent');
  const selectChange = (c?: Row) => {
    setChangeId(c?.id || '');
    setEditLock(c?.lock_version ?? 0);
    setShare('');
    setReviewed(false);
    setForm(
      c
        ? {
            title: c.title,
            description: c.description,
            base: (c.base_cents / 100).toFixed(2).replace('.', ','),
            taxBasisPoints: c.tax_basis_points,
            days: c.days,
          }
        : blank,
    );
  };
  const perform = async (action: Row) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/workspace', action);
      try {
        await load();
      } catch {
        setError(
          'La operación se ha guardado, pero no se pudo actualizar la vista. Pulsa Reintentar para cargarla.',
        );
      }
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await perform({
      ...form,
      action: selected ? 'edit' : 'createChange',
      projectId,
      id: changeId,
      lockVersion: editLock,
    });
    if (r) {
      setChangeId(r.id);
      setEditLock(selected ? editLock + 1 : 0);
      setReviewed(false);
      setNotice(
        'Borrador guardado. Revisa los datos antes de crear el enlace.',
      );
    }
  };
  const send = async () => {
    const r = await perform({
      action: 'send',
      id: changeId,
      lockVersion: editLock,
      reviewed,
    });
    if (r) {
      setShare(location.origin + r.path);
      setNotice(
        'Versión preparada. Comparte el enlace con tu cliente; todavía no se ha enviado ningún mensaje.',
      );
    }
  };
  const update = async (action: string) => {
    const r = await perform({
      action,
      id: changeId,
      lockVersion: selected?.lock_version,
      ...(action === 'revise' ? form : {}),
    });
    if (r) {
      setShare('');
      if (action === 'revise') {
        setChangeId(r.id);
        setEditLock(0);
        setReviewed(false);
      }
      setNotice(
        action === 'pay'
          ? 'Cobro completo registrado manualmente.'
          : action === 'revise'
            ? 'Nuevo borrador creado; el enlace anterior ya no admite decisiones.'
            : 'Estado actualizado.',
      );
    }
  };
  let preview = 0;
  let parsedBase = -1;
  try {
    parsedBase = parseEuroInput(form.base);
    preview = calculateTotal(parsedBase, form.taxBasisPoints).totalCents;
  } catch {}
  const unchanged =
    selected &&
    form.title.trim() === selected.title &&
    form.description.trim() === selected.description &&
    parsedBase === selected.base_cents &&
    form.taxBasisPoints === selected.tax_basis_points &&
    form.days === selected.days;
  const locked = selected && selected.status !== 'draft';
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            project,
            changes,
            events: data.events.filter((e) =>
              changes.some((c) => c.id === e.change_id),
            ),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extraclaro-obra.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'list_extraclaro_projects',
          title: 'Consultar obras y extras',
          description:
            'Consulta las obras y extras del usuario autenticado. No crea ni modifica datos.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: unknown) => {
            if (
              !input ||
              typeof input !== 'object' ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw Error('No se admiten parámetros.');
            return request('/api/workspace');
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="/">
          extra<span>claro</span>
          <b>+</b>
        </a>
        <span className="pilot">
          {userName}
          <br />
          <a href="/signout-with-chatgpt?return_to=/" target="_top">
            Cerrar sesión
          </a>
        </span>
      </header>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONTROL DE OBRA</p>
          <h1>Cada extra, claro.</h1>
          <p>Acuerda el alcance y el precio antes de empezar.</p>
        </div>
        <Button onClick={() => setNewProject(true)}>
          <Plus /> Nueva obra
        </Button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <Button
            variant="ghost"
            onClick={() =>
              load()
                .then(() => setError(''))
                .catch((e) => setError(e.message))
            }
          >
            Reintentar
          </Button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {loading ? (
        <p role="status">Cargando tus obras…</p>
      ) : !data.projects.length ? (
        <section className="panel empty-work">
          <Building2 size={40} className="mx-auto text-blue-600 mb-5" />
          <h2>Tu primera obra empieza aquí</h2>
          <p>
            Añade una obra para tener sus extras, decisiones y cobros en un
            mismo lugar.
          </p>
          <Button onClick={() => setNewProject(true)}>
            <Plus /> Crear primera obra
          </Button>
        </section>
      ) : (
        <>
          <div className="project-strip">
            <label className="project-picker">
              Obra activa
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v || '');
                  selectChange();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{project?.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {data.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <span className="muted">Cliente · {project?.client}</span>
            <Button variant="outline" onClick={exportData}>
              <Download /> Exportar historial
            </Button>
          </div>
          <div className="metrics">
            <div>
              <span>Presupuesto original</span>
              <strong>{formatEuro(project?.budget_cents || 0)}</strong>
              <small>IVA incluido</small>
            </div>
            <div>
              <span>Extras aprobados</span>
              <strong className="blue">+ {formatEuro(approved)}</strong>
              <small>
                {
                  changes.filter((c) =>
                    ['approved', 'executed', 'paid'].includes(c.status),
                  ).length
                }{' '}
                extras acordados
              </small>
            </div>
            <div>
              <span>Total de la obra</span>
              <strong>
                {formatEuro((project?.budget_cents || 0) + approved)}
              </strong>
              <small>Original + extras aprobados</small>
            </div>
          </div>
          <div className="workgrid">
            <section className="panel change-list">
              <div className="section-title justify-between">
                <h2>
                  Extras de esta obra{' '}
                  <span className="counter">{changes.length}</span>
                </h2>
                <Button variant="outline" onClick={() => selectChange()}>
                  <Plus /> Nuevo
                </Button>
              </div>
              {pending.length > 0 && (
                <p className="muted pending-line">
                  <Clock size={16} /> {pending.length} pendientes de respuesta
                </p>
              )}
              {!changes.length ? (
                <div className="empty-work">
                  <FileText size={36} className="mx-auto text-blue-600 mb-4" />
                  <h3>El primer cambio, por escrito</h3>
                  <p>
                    Describe qué se añade y cuánto cuesta. Después podrás
                    compartirlo con tu cliente.
                  </p>
                </div>
              ) : (
                changes.map((c) => (
                  <button
                    key={c.id}
                    className={
                      'change-card ' + (changeId === c.id ? 'selected' : '')
                    }
                    onClick={() => selectChange(c)}
                  >
                    <div>
                      <span className={'status ' + c.status}>
                        {labels[c.status]}
                      </span>
                      <span className="muted">v{c.revision}</span>
                    </div>
                    <h3>{c.title}</h3>
                    <p>{c.description}</p>
                    <footer>
                      <strong>{formatEuro(c.total_cents)}</strong>
                      <span>
                        {c.days === 0
                          ? 'Sin cambio de plazo'
                          : `+ ${c.days} días`}
                      </span>
                      <ArrowUpRight size={18} />
                    </footer>
                  </button>
                ))
              )}
            </section>
            <section className="panel editor" key={projectId}>
              <p className="eyebrow">
                {selected
                  ? `VERSIÓN ${selected.revision} · ${labels[selected.status].toUpperCase()}`
                  : 'NUEVO EXTRA'}
              </p>
              <h2>
                {selected ? 'Detalle del extra' : 'Deja el cambio por escrito'}
              </h2>
              <form onSubmit={save}>
                <label>
                  Título
                  <Input
                    required
                    maxLength={140}
                    value={form.title}
                    disabled={!!locked || busy}
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      setReviewed(false);
                    }}
                    placeholder="Dos enchufes en la cocina"
                  />
                </label>
                <label>
                  Qué incluye
                  <Textarea
                    required
                    maxLength={2000}
                    rows={3}
                    value={form.description}
                    disabled={!!locked || busy}
                    onChange={(e) => {
                      setForm({ ...form, description: e.target.value });
                      setReviewed(false);
                    }}
                    placeholder="Suministro, instalación y remate de dos puntos de corriente."
                  />
                </label>
                <div className="form-columns">
                  <label>
                    Base imponible (€)
                    <Input
                      required
                      inputMode="decimal"
                      value={form.base}
                      disabled={!!locked || busy}
                      onChange={(e) => {
                        setForm({ ...form, base: e.target.value });
                        setReviewed(false);
                      }}
                      placeholder="140,00"
                    />
                  </label>
                  <label>
                    IVA (%)
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.taxBasisPoints / 100}
                      disabled={!!locked || busy}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          taxBasisPoints: Math.round(
                            Number(e.target.value) * 100,
                          ),
                        });
                        setReviewed(false);
                      }}
                    />
                  </label>
                </div>
                <label>
                  Días adicionales estimados
                  <Input
                    type="number"
                    min="0"
                    max="3650"
                    value={form.days}
                    disabled={!!locked || busy}
                    onChange={(e) => {
                      setForm({ ...form, days: Number(e.target.value) });
                      setReviewed(false);
                    }}
                  />
                </label>
                <div className="extra-total">
                  <span>
                    Total del extra <small>IVA incluido</small>
                  </span>
                  <strong>{formatEuro(preview)}</strong>
                </div>
                {!locked && (
                  <>
                    <Button disabled={busy} type="submit">
                      {selected ? 'Guardar cambios' : 'Guardar borrador'}
                    </Button>
                    {selected && (
                      <>
                        <label className="check-label">
                          <Checkbox
                            checked={reviewed}
                            disabled={!unchanged || busy}
                            onCheckedChange={(v) => setReviewed(v === true)}
                          />
                          <span>
                            He revisado el alcance, el precio, el IVA y el
                            plazo.
                          </span>
                        </label>
                        <Button
                          type="button"
                          disabled={busy || !reviewed || !unchanged}
                          onClick={send}
                        >
                          <LinkIcon /> Crear enlace de aprobación
                        </Button>
                        {!unchanged && (
                          <p className="muted">
                            Guarda los cambios antes de preparar el enlace.
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </form>
              {share && (
                <div className="share-box">
                  <h3>Enlace listo para compartir</h3>
                  <Input
                    aria-label="Enlace de aprobación"
                    readOnly
                    value={share}
                  />
                  <div className="actions">
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(share)
                          .then(() => setNotice('Enlace copiado.'))
                          .catch(() =>
                            setError(
                              'No se pudo copiar. Selecciona el enlace y cópialo manualmente.',
                            ),
                          )
                      }
                    >
                      Copiar
                    </Button>
                    <a href={share} target="_blank" rel="noreferrer">
                      Abrir revisión ↗
                    </a>
                    <a
                      href={
                        'https://wa.me/?text=' +
                        encodeURIComponent(
                          `Revisa este extra de ${project?.name}: ${share}`,
                        )
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Compartir por WhatsApp ↗
                    </a>
                  </div>
                  <p className="muted">
                    Conserva este enlace. Solo se muestra al crearlo y caduca en
                    7 días. El piloto privado está limitado al propietario del
                    sitio.
                  </p>
                </div>
              )}
              {locked && (
                <div className="actions mt-5">
                  {['sent', 'rejected'].includes(selected.status) && (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => update('revise')}
                    >
                      Crear nueva versión
                    </Button>
                  )}
                  {selected.status === 'sent' && (
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={() => update('void')}
                    >
                      Anular enlace
                    </Button>
                  )}
                  {selected.status === 'approved' && (
                    <Button disabled={busy} onClick={() => update('execute')}>
                      <Check /> Marcar ejecutado
                    </Button>
                  )}
                  {selected.status === 'executed' && (
                    <Button disabled={busy} onClick={() => update('pay')}>
                      Registrar cobro completo
                    </Button>
                  )}
                </div>
              )}
              {selected && (
                <div className="history">
                  <h3>Historial</h3>
                  {data.events
                    .filter((e) => e.change_id === selected.id)
                    .map((e) => (
                      <div key={e.id}>
                        <i />
                        <p>
                          {e.detail}
                          <small>
                            {new Date(e.at).toLocaleString('es-ES')}
                          </small>
                        </p>
                      </div>
                    ))}
                  {selected.decision_name && (
                    <p className="muted">
                      Respuesta registrada por {selected.decision_name}.
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      )}
      <Dialog open={newProject} onOpenChange={setNewProject}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Nueva obra</DialogTitle>
          <DialogDescription>
            El presupuesto original incluye IVA y servirá para mostrar el total
            con los extras.
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await perform({
                action: 'createProject',
                ...projectForm,
              });
              if (r) {
                setProjectId(r.id);
                selectChange();
                setNewProject(false);
                setProjectForm({ name: '', client: '', budget: '' });
              }
            }}
          >
            <label>
              Nombre de la obra
              <Input
                autoFocus
                required
                maxLength={140}
                value={projectForm.name}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, name: e.target.value })
                }
                placeholder="Reforma del baño · Calle Mayor"
              />
            </label>
            <label>
              Cliente
              <Input
                required
                maxLength={140}
                value={projectForm.client}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, client: e.target.value })
                }
                placeholder="Nombre del cliente"
              />
            </label>
            <label>
              Presupuesto original, IVA incluido (€)
              <Input
                required
                inputMode="decimal"
                value={projectForm.budget}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, budget: e.target.value })
                }
                placeholder="12000,00"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Crear obra'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
