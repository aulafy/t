'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { formatEuro } from '@/lib/domain/money.mjs';
export default function Review({ token }: { token: string }) {
  const [data, setData] = useState<Record<string, any> | null>(null),
    [error, setError] = useState(''),
    [name, setName] = useState(''),
    [comment, setComment] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  const load = async () => {
    const r = await fetch('/api/review/' + token);
    const d: any = await r.json();
    if (!r.ok) throw Error(d.error);
    setData(d);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [token]);
  const decide = async (decision: string) => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/review/' + token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          name,
          comment,
          confirmed,
          key,
          snapshotHash: data?.snapshotHash,
        }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const unavailable =
    data && (data.status !== 'sent' || data.expired || data.stale);
  return (
    <main className="review-page">
      <header className="topbar">
        <span className="brand">
          extra<span>claro</span>
          <b>+</b>
        </span>
        <span className="pilot">Revisión del cliente</span>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!data && !error && <p role="status">Cargando el extra…</p>}
      {data && (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {data.project} · VERSIÓN {data.revision}
              </p>
              <h1>{data.title}</h1>
              <p>Preparado para {data.client}</p>
            </div>
          </div>
          <section className="panel">
            <h2>Qué incluye</h2>
            <p className="description">{data.description}</p>
            <div className="breakdown">
              <div>
                <span>Base imponible</span>
                <strong>{formatEuro(data.baseCents)}</strong>
              </div>
              <div>
                <span>IVA ({data.taxBasisPoints / 100} %)</span>
                <strong>{formatEuro(data.taxCents)}</strong>
              </div>
              <div className="total-line">
                <span>Total de este extra</span>
                <strong>{formatEuro(data.totalCents)}</strong>
              </div>
            </div>
            <p className="delay">
              {data.days
                ? `Plazo estimado: ${data.days} días adicionales.`
                : 'Sin días adicionales previstos.'}
            </p>
          </section>
          <section className="panel mt-5">
            <h2>Así queda el total de la obra</h2>
            <div className="breakdown">
              <div>
                <span>Presupuesto original, IVA incluido</span>
                <strong>{formatEuro(data.budgetCents)}</strong>
              </div>
              <div>
                <span>Otros extras aprobados al preparar esta versión</span>
                <strong>{formatEuro(data.previousCents)}</strong>
              </div>
              <div>
                <span>Este extra, IVA incluido</span>
                <strong>{formatEuro(data.totalCents)}</strong>
              </div>
              <div className="total-line">
                <span>Total si apruebas esta versión</span>
                <strong>
                  {formatEuro(
                    data.budgetCents + data.previousCents + data.totalCents,
                  )}
                </strong>
              </div>
            </div>
          </section>
          <section className="panel mt-5 decision-panel">
            {unavailable ? (
              <>
                <h2>
                  {data.decisionType === 'approve'
                    ? 'Aprobación registrada'
                    : data.decisionType === 'reject'
                      ? 'Rechazo registrado'
                      : data.stale
                        ? 'El total ha cambiado'
                        : 'Enlace caducado'}
                </h2>
                <p>
                  {data.decisionName
                    ? `${data.decisionName} respondió el ${new Date(data.decisionAt).toLocaleString('es-ES')}.`
                    : 'Pide al profesional una nueva versión antes de responder.'}
                </p>
                <Button variant="outline" onClick={() => window.print()}>
                  Imprimir / guardar PDF
                </Button>
              </>
            ) : (
              <>
                <h2>Tu decisión, sobre esta versión</h2>
                <p className="muted">
                  Válido hasta{' '}
                  {new Date(data.expiresAt).toLocaleString('es-ES')}. No
                  responder no implica aceptar.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void decide('approve');
                  }}
                >
                  <label>
                    Tu nombre
                    <Input
                      required
                      maxLength={140}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Comentario (opcional)
                    <Textarea
                      maxLength={1000}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </label>
                  <label className="check-label">
                    <Checkbox
                      checked={confirmed}
                      onCheckedChange={(v) => setConfirmed(v === true)}
                    />
                    <span>
                      He leído el alcance, el importe y el plazo de esta
                      versión.
                    </span>
                  </label>
                  <div className="actions">
                    <Button
                      type="submit"
                      disabled={busy || !confirmed || !name.trim()}
                    >
                      Aprobar {formatEuro(data.totalCents)}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !confirmed || !name.trim()}
                      onClick={() => decide('reject')}
                    >
                      Rechazar extra
                    </Button>
                  </div>
                </form>
              </>
            )}
          </section>
          <p className="muted footnote">
            La respuesta guarda tu nombre declarado, la fecha y la versión
            revisada. Conserva una copia del acuerdo. Referencia:{' '}
            {data.id.slice(0, 8)} · v{data.revision}
          </p>
        </>
      )}
    </main>
  );
}
