import { getRawDb } from '@/db';
import { calculateTotal } from './domain/change.mjs';
import { parseEuroInput } from './domain/money.mjs';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Row = Record<string, any>;
export const now = () => new Date().toISOString();
const maxCents = 100_000_000_00;
export function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new AppError(400, 'Completa los campos con texto válido.');
  return value.trim();
}
function amount(value: unknown) {
  let n;
  try {
    n = parseEuroInput(value);
  } catch (e) {
    throw new AppError(400, (e as Error).message);
  }
  if (n > maxCents)
    throw new AppError(
      400,
      'El importe supera el límite de 100 millones de euros.',
    );
  return n;
}
function integer(value: unknown, max: number) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  )
    throw new AppError(400, 'Valor numérico inválido.');
  return value;
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export async function ownedProject(owner: string, id: string) {
  const p = await getRawDb()
    .prepare('SELECT * FROM projects WHERE id=? AND owner_id=?')
    .bind(id, owner)
    .first<Row>();
  if (!p) throw new AppError(404, 'Obra no encontrada.');
  return p;
}
async function ownedChange(owner: string, id: string) {
  const c = await getRawDb()
    .prepare(
      'SELECT c.* FROM changes c JOIN projects p ON p.id=c.project_id WHERE c.id=? AND p.owner_id=?',
    )
    .bind(id, owner)
    .first<Row>();
  if (!c) throw new AppError(404, 'Extra no encontrado.');
  return c;
}
async function previous(projectId: string) {
  const r = await getRawDb()
    .prepare(
      "SELECT COALESCE(SUM(total_cents),0) AS total FROM changes WHERE project_id=? AND status IN ('approved','executed','paid')",
    )
    .bind(projectId)
    .first<{ total: number }>();
  return r?.total ?? 0;
}
export async function workspace(owner: string) {
  const db = getRawDb();
  const p = await db
    .prepare('SELECT * FROM projects WHERE owner_id=? ORDER BY created_at DESC')
    .bind(owner)
    .all();
  const c = await db
    .prepare(
      'SELECT c.* FROM changes c JOIN projects p ON p.id=c.project_id WHERE p.owner_id=? ORDER BY c.created_at DESC',
    )
    .bind(owner)
    .all<Row>();
  const e = await db
    .prepare(
      'SELECT e.* FROM events e JOIN changes c ON c.id=e.change_id JOIN projects p ON p.id=c.project_id WHERE p.owner_id=? ORDER BY e.at DESC',
    )
    .bind(owner)
    .all();
  return {
    projects: p.results,
    changes: c.results.map(({ token_hash, ...rest }) => rest),
    events: e.results,
  };
}
function eventSql(
  id: string,
  kind: string,
  actor: string,
  op: string,
  detail: string,
) {
  return getRawDb()
    .prepare(
      'INSERT INTO events (id,change_id,kind,actor,at,detail,operation_id) SELECT ?,id,?,?,?,?,? FROM changes WHERE id=? AND last_operation=?',
    )
    .bind(crypto.randomUUID(), kind, actor, now(), detail, op, id, op);
}
function assertChanged(result: D1Result) {
  if (result.meta.changes !== 1)
    throw new AppError(
      409,
      'El extra ha cambiado. Actualiza la página y vuelve a revisarlo.',
    );
}
function fields(b: Row) {
  const base = amount(b.base);
  const rate = integer(b.taxBasisPoints, 10000);
  const total = calculateTotal(base, rate);
  return {
    title: text(b.title, 140),
    description: text(b.description),
    days: integer(b.days, 3650),
    ...total,
    taxBasisPoints: rate,
  };
}
export async function mutate(owner: string, b: Row) {
  const db = getRawDb();
  const action = text(b.action, 40);
  const op = crypto.randomUUID();
  if (action === 'createProject') {
    const id = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO projects (id,owner_id,name,client,budget_cents,created_at) VALUES (?,?,?,?,?,?)',
      )
      .bind(
        id,
        owner,
        text(b.name, 140),
        text(b.client, 140),
        amount(b.budget),
        now(),
      )
      .run();
    return { id };
  }
  if (action === 'createChange') {
    const p = await ownedProject(owner, text(b.projectId, 80));
    const f = fields(b);
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          'INSERT INTO changes (id,project_id,root_id,title,description,base_cents,tax_basis_points,tax_cents,total_cents,days,last_operation,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          p.id,
          id,
          f.title,
          f.description,
          f.baseCents,
          f.taxBasisPoints,
          f.taxCents,
          f.totalCents,
          f.days,
          op,
          now(),
        ),
      eventSql(id, 'draft', owner, op, 'Borrador creado'),
    ]);
    return { id };
  }
  const c = await ownedChange(owner, text(b.id, 80));
  const p = await ownedProject(owner, c.project_id);
  if (action === 'edit') {
    const f = fields(b);
    const lock = integer(b.lockVersion, Number.MAX_SAFE_INTEGER);
    const r = await db.batch([
      db
        .prepare(
          "UPDATE changes SET title=?,description=?,base_cents=?,tax_basis_points=?,tax_cents=?,total_cents=?,days=?,lock_version=lock_version+1,last_operation=? WHERE id=? AND status='draft' AND lock_version=?",
        )
        .bind(
          f.title,
          f.description,
          f.baseCents,
          f.taxBasisPoints,
          f.taxCents,
          f.totalCents,
          f.days,
          op,
          c.id,
          lock,
        ),
      eventSql(c.id, 'edited', owner, op, 'Borrador actualizado'),
    ]);
    assertChanged(r[0]);
    return { id: c.id };
  }
  if (action === 'send') {
    if (b.reviewed !== true)
      throw new AppError(
        400,
        'Revisa el alcance, precio y plazo antes de enviar.',
      );
    if (c.status !== 'draft')
      throw new AppError(409, 'Solo se puede enviar un borrador.');
    const lock = integer(b.lockVersion, Number.MAX_SAFE_INTEGER);
    const raw = token();
    const th = await hash(raw);
    const prev = await previous(p.id);
    const expiry = new Date(Date.now() + 7 * 86400000).toISOString();
    const snapshot = {
      project: p.name,
      client: p.client,
      budgetCents: p.budget_cents,
      title: c.title,
      description: c.description,
      baseCents: c.base_cents,
      taxBasisPoints: c.tax_basis_points,
      taxCents: c.tax_cents,
      totalCents: c.total_cents,
      days: c.days,
      revision: c.revision,
      previousCents: prev,
      contextVersion: p.version,
    };
    if (!Number.isSafeInteger(p.budget_cents + prev + c.total_cents))
      throw new AppError(
        400,
        'El total acumulado supera el límite de precisión.',
      );
    const sh = await hash(JSON.stringify(snapshot));
    const r = await db.batch([
      db
        .prepare(
          "UPDATE changes SET status='sent',token_hash=?,expires_at=?,context_version=?,previous_cents=?,snapshot_hash=?,lock_version=lock_version+1,last_operation=? WHERE id=? AND status='draft' AND lock_version=? AND EXISTS (SELECT 1 FROM projects WHERE id=? AND version=?)",
        )
        .bind(th, expiry, p.version, prev, sh, op, c.id, lock, p.id, p.version),
      eventSql(
        c.id,
        'sent',
        owner,
        op,
        'Versión congelada para revisión del cliente',
      ),
    ]);
    assertChanged(r[0]);
    return { id: c.id, path: '/c/' + raw };
  }
  if (action === 'revise') {
    const f = fields(b);
    const id = crypto.randomUUID();
    const r = await db.batch([
      db
        .prepare(
          "UPDATE changes SET status='void',last_operation=?,lock_version=lock_version+1 WHERE id=? AND status IN ('sent','rejected') AND lock_version=?",
        )
        .bind(op, c.id, integer(b.lockVersion, Number.MAX_SAFE_INTEGER)),
      db
        .prepare(
          'INSERT INTO changes (id,project_id,root_id,revision,title,description,base_cents,tax_basis_points,tax_cents,total_cents,days,last_operation,created_at) SELECT ?,project_id,root_id,revision+1,?,?,?,?,?,?,?,?,? FROM changes WHERE id=? AND last_operation=?',
        )
        .bind(
          id,
          f.title,
          f.description,
          f.baseCents,
          f.taxBasisPoints,
          f.taxCents,
          f.totalCents,
          f.days,
          op,
          now(),
          c.id,
          op,
        ),
      eventSql(
        c.id,
        'superseded',
        owner,
        op,
        'Versión sustituida por un nuevo borrador',
      ),
    ]);
    assertChanged(r[0]);
    return { id };
  }
  const transitions: Record<string, [string, string]> = {
    void: ['sent', 'void'],
    execute: ['approved', 'executed'],
    pay: ['executed', 'paid'],
  };
  if (!Object.hasOwn(transitions, action))
    throw new AppError(400, 'Acción desconocida.');
  const [from, to] = transitions[action];
  const valid =
    c.status === from || (action === 'void' && c.status === 'draft');
  if (!valid)
    throw new AppError(
      409,
      'Esta acción no está disponible en el estado actual.',
    );
  const r = await db.batch([
    db
      .prepare(
        'UPDATE changes SET status=?,last_operation=?,lock_version=lock_version+1 WHERE id=? AND status=? AND lock_version=?',
      )
      .bind(
        to,
        op,
        c.id,
        c.status,
        integer(b.lockVersion, Number.MAX_SAFE_INTEGER),
      ),
    eventSql(
      c.id,
      to,
      owner,
      op,
      action === 'pay'
        ? 'Cobro completo registrado manualmente'
        : action === 'execute'
          ? 'Ejecución registrada'
          : 'Enlace anulado',
    ),
  ]);
  assertChanged(r[0]);
  return { id: c.id };
}
export async function review(raw: string) {
  if (!/^[a-f0-9]{64}$/.test(raw))
    throw new AppError(404, 'Enlace no encontrado.');
  const c = await getRawDb()
    .prepare(
      'SELECT c.*,p.name AS project_name,p.client,p.budget_cents,p.version AS project_version FROM changes c JOIN projects p ON p.id=c.project_id WHERE c.token_hash=?',
    )
    .bind(await hash(raw))
    .first<Row>();
  if (!c) throw new AppError(404, 'Enlace no encontrado.');
  if (c.status === 'void')
    throw new AppError(
      410,
      'Este enlace ha sido anulado o sustituido. Pide la versión actual.',
    );
  return c;
}
export function publicView(c: Row) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    baseCents: c.base_cents,
    taxBasisPoints: c.tax_basis_points,
    taxCents: c.tax_cents,
    totalCents: c.total_cents,
    days: c.days,
    revision: c.revision,
    previousCents: c.previous_cents,
    budgetCents: c.budget_cents,
    project: c.project_name,
    client: c.client,
    status: c.status,
    expiresAt: c.expires_at,
    expired: c.expires_at < now(),
    stale: c.status === 'sent' && c.context_version !== c.project_version,
    snapshotHash: c.snapshot_hash,
    decisionName: c.decision_name,
    decisionAt: c.decision_at,
    decisionType: c.decision_type,
  };
}
export async function decide(raw: string, b: Row) {
  const c = await review(raw);
  const decision = text(b.decision, 10);
  if (!['approve', 'reject'].includes(decision))
    throw new AppError(400, 'Decisión no válida.');
  const name = text(b.name, 140);
  const comment = typeof b.comment === 'string' ? b.comment.trim() : '';
  if (comment.length > 1000)
    throw new AppError(400, 'El comentario es demasiado largo.');
  const key = text(b.key, 80);
  if (!/^[a-f0-9-]{36}$/.test(key))
    throw new AppError(400, 'Identificador de solicitud inválido.');
  if (c.decision_key === key) {
    if (
      c.decision_type !== decision ||
      c.decision_name !== name ||
      c.decision_comment !== comment
    )
      throw new AppError(409, 'La solicitud ya se usó con otros datos.');
    return publicView(c);
  }
  if (c.status !== 'sent')
    throw new AppError(409, 'Esta versión ya tiene una decisión.');
  if (c.expires_at < now())
    throw new AppError(410, 'El enlace ha caducado. Pide una nueva versión.');
  if (c.context_version !== c.project_version)
    throw new AppError(
      409,
      'El total de la obra ha cambiado. Pide una nueva versión antes de decidir.',
    );
  if (b.snapshotHash !== c.snapshot_hash || b.confirmed !== true)
    throw new AppError(
      400,
      'Revisa y confirma esta versión antes de responder.',
    );
  const db = getRawDb(),
    op = crypto.randomUUID(),
    at = now(),
    status = decision === 'approve' ? 'approved' : 'rejected';
  const statements = [
    db
      .prepare(
        "UPDATE changes SET status=?,decision_key=?,decision_name=?,decision_type=?,decision_comment=?,decision_at=?,last_operation=?,lock_version=lock_version+1 WHERE id=? AND status='sent' AND expires_at>=? AND snapshot_hash=? AND EXISTS (SELECT 1 FROM projects p WHERE p.id=changes.project_id AND p.version=changes.context_version)",
      )
      .bind(
        status,
        key,
        name,
        decision,
        comment,
        at,
        op,
        c.id,
        at,
        c.snapshot_hash,
      ),
  ];
  if (decision === 'approve')
    statements.push(
      db
        .prepare(
          'UPDATE projects SET version=version+1 WHERE id=? AND EXISTS (SELECT 1 FROM changes WHERE id=? AND last_operation=?)',
        )
        .bind(c.project_id, c.id, op),
    );
  statements.push(
    eventSql(
      c.id,
      status,
      name,
      op,
      comment || 'Decisión registrada sobre la versión mostrada',
    ),
  );
  const r = await db.batch(statements);
  if (r[0].meta.changes !== 1) {
    const fresh = await review(raw);
    if (
      fresh.decision_key === key &&
      fresh.decision_type === decision &&
      fresh.decision_name === name &&
      fresh.decision_comment === comment
    )
      return publicView(fresh);
    throw new AppError(
      409,
      'La versión ha cambiado. Recarga antes de responder.',
    );
  }
  return publicView(await review(raw));
}
