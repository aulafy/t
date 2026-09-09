import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
let sqlite;
class Statement {
  constructor(sql, args = []) {
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Statement(this.sql, args);
  }
  async first() {
    return sqlite.prepare(this.sql).get(...this.args) ?? null;
  }
  async all() {
    return { results: sqlite.prepare(this.sql).all(...this.args) };
  }
  async run() {
    const r = sqlite.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}
const adapter = {
  prepare: (sql) => new Statement(sql),
  async batch(items) {
    sqlite.exec('BEGIN');
    try {
      const out = [];
      for (const q of items) out.push(await q.run());
      sqlite.exec('COMMIT');
      return out;
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
};
// Serializa batch como D1: cada lote se ejecuta íntegro antes del siguiente.
let queue = Promise.resolve();
const originalBatch = adapter.batch.bind(adapter);
adapter.batch = (items) => {
  const next = queue.then(() => originalBatch(items));
  queue = next.catch(() => {});
  return next;
};
globalThis.__extraclaroTestDb = adapter;
let src = readFileSync(
  new URL('../lib/service.ts', import.meta.url),
  'utf8',
).replace(
  "import { getRawDb } from '@/db';",
  'const getRawDb = () => globalThis.__extraclaroTestDb;',
);
for (const name of ['change', 'money'])
  src = src.replace(
    `'./domain/${name}.mjs'`,
    JSON.stringify(new URL(`../lib/domain/${name}.mjs`, import.meta.url).href),
  );
const compiled = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const service = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
beforeEach(() => {
  sqlite?.close();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const f of readdirSync(new URL('../drizzle', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(
      readFileSync(new URL('../drizzle/' + f, import.meta.url), 'utf8'),
    );
});
const owner = 'empresa-a';
async function project(user = owner) {
  return (
    await service.mutate(user, {
      action: 'createProject',
      name: 'Baño de prueba',
      client: 'Cliente sintético',
      budget: '12000',
    })
  ).id;
}
async function draft(pid) {
  return (
    await service.mutate(owner, {
      action: 'createChange',
      projectId: pid,
      title: 'Dos enchufes',
      description: 'Suministro e instalación',
      base: '140',
      taxBasisPoints: 2100,
      days: 1,
    })
  ).id;
}
async function send(id) {
  return (
    await service.mutate(owner, {
      action: 'send',
      id,
      lockVersion: 0,
      reviewed: true,
    })
  ).path
    .split('/')
    .at(-1);
}
async function decision(token, extra = {}) {
  const c = await service.review(token);
  return {
    decision: 'approve',
    name: 'Cliente de prueba',
    comment: '',
    confirmed: true,
    key: crypto.randomUUID(),
    snapshotHash: c.snapshot_hash,
    ...extra,
  };
}
const row = (id) => sqlite.prepare('SELECT * FROM changes WHERE id=?').get(id);

test('flujo persistente: obra, borrador, envío, aprobación, ejecución y cobro', async () => {
  const p = await project(),
    id = await draft(p),
    token = await send(id);
  const v = service.publicView(await service.review(token));
  assert.equal(v.totalCents, 16940);
  assert.equal(v.budgetCents, 1200000);
  assert.equal(v.previousCents, 0);
  assert.ok(!('tokenHash' in v));
  await service.decide(token, await decision(token));
  await service.mutate(owner, {
    action: 'execute',
    id,
    lockVersion: row(id).lock_version,
  });
  await service.mutate(owner, {
    action: 'pay',
    id,
    lockVersion: row(id).lock_version,
  });
  assert.equal(row(id).status, 'paid');
  assert.equal((await service.workspace(owner)).events.length, 5);
});
test('aislamiento de empresa en lectura y mutaciones', async () => {
  const p = await project('empresa-b');
  assert.equal((await service.workspace(owner)).projects.length, 0);
  await assert.rejects(
    () => draft(p),
    (e) => e.status === 404,
  );
  const id = await draft(await project());
  await assert.rejects(
    () => service.mutate('empresa-b', { action: 'void', id, lockVersion: 0 }),
    (e) => e.status === 404,
  );
});
test('reintento idéntico no duplica eventos ni suma otra vez al total', async () => {
  const p = await project(),
    id = await draft(p),
    token = await send(id),
    b = await decision(token);
  await service.decide(token, b);
  await service.decide(token, b);
  assert.equal(
    sqlite.prepare('SELECT version FROM projects WHERE id=?').get(p).version,
    1,
  );
  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS n FROM events WHERE kind='approved'")
      .get().n,
    1,
  );
  await assert.rejects(
    () => service.decide(token, { ...b, name: 'Otra persona' }),
    (e) => e.status === 409,
  );
});
test('dos decisiones concurrentes opuestas producen solo una decisión', async () => {
  const id = await draft(await project()),
    token = await send(id),
    b = await decision(token);
  const r = await Promise.allSettled([
    service.decide(token, b),
    service.decide(token, {
      ...b,
      key: crypto.randomUUID(),
      decision: 'reject',
    }),
  ]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM events WHERE kind IN ('approved','rejected')",
      )
      .get().n,
    1,
  );
});
test('dos extras enviados con el mismo total: solo uno se aprueba sin nueva revisión', async () => {
  const p = await project(),
    a = await draft(p),
    b = await draft(p),
    ta = await send(a),
    tb = await send(b);
  const da = await decision(ta),
    db = await decision(tb);
  const r = await Promise.allSettled([
    service.decide(ta, da),
    service.decide(tb, db),
  ]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    sqlite.prepare('SELECT version FROM projects WHERE id=?').get(p).version,
    1,
  );
});
test('borrador editado exige la versión nueva y un envío no se puede editar', async () => {
  const id = await draft(await project());
  const f = {
    action: 'edit',
    id,
    lockVersion: 0,
    title: 'Cambio',
    description: 'Nueva descripción',
    base: '150',
    taxBasisPoints: 2100,
    days: 2,
  };
  await service.mutate(owner, f);
  await assert.rejects(
    () =>
      service.mutate(owner, {
        action: 'send',
        id,
        lockVersion: 0,
        reviewed: true,
      }),
    (e) => e.status === 409,
  );
  await service.mutate(owner, {
    action: 'send',
    id,
    lockVersion: 1,
    reviewed: true,
  });
  await assert.rejects(
    () => service.mutate(owner, { ...f, lockVersion: 2 }),
    (e) => e.status === 409,
  );
});
test('nueva versión revoca enlace anterior y preserva contenido previo', async () => {
  const p = await project(),
    id = await draft(p),
    token = await send(id);
  const result = await service.mutate(owner, {
    action: 'revise',
    id,
    lockVersion: 1,
    title: 'Tres enchufes',
    description: 'Tres puntos',
    base: '210',
    taxBasisPoints: 2100,
    days: 1,
  });
  await assert.rejects(
    () => service.review(token),
    (e) => e.status === 410,
  );
  assert.equal(row(id).title, 'Dos enchufes');
  assert.equal(row(result.id).revision, 2);
  assert.equal(row(result.id).status, 'draft');
});
test('rechazo preservado al crear versión siguiente', async () => {
  const id = await draft(await project()),
    token = await send(id);
  await service.decide(token, await decision(token, { decision: 'reject' }));
  await service.mutate(owner, {
    action: 'revise',
    id,
    lockVersion: 2,
    title: 'Cambio',
    description: 'Corregido',
    base: '140',
    taxBasisPoints: 2100,
    days: 0,
  });
  assert.equal(row(id).decision_type, 'reject');
  assert.ok(row(id).decision_at);
});
test('caducidad, anulación, hash incorrecto y falta de confirmación no deciden', async () => {
  const id = await draft(await project()),
    token = await send(id),
    b = await decision(token);
  await assert.rejects(
    () => service.decide(token, { ...b, snapshotHash: 'bad' }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () => service.decide(token, { ...b, confirmed: false }),
    (e) => e.status === 400,
  );
  sqlite
    .prepare('UPDATE changes SET expires_at=? WHERE id=?')
    .run('2000-01-01T00:00:00.000Z', id);
  await assert.rejects(
    () => service.decide(token, b),
    (e) => e.status === 410,
  );
  await service.mutate(owner, { action: 'void', id, lockVersion: 1 });
  await assert.rejects(
    () => service.review(token),
    (e) => e.status === 410,
  );
  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS n FROM events WHERE kind='approved'")
      .get().n,
    0,
  );
});
test('no se cobra ni ejecuta un extra pendiente', async () => {
  const id = await draft(await project());
  for (const action of ['execute', 'pay'])
    await assert.rejects(
      () => service.mutate(owner, { action, id, lockVersion: 0 }),
      (e) => e.status === 409,
    );
});
test('texto hostil sigue siendo texto y los importes ambiguos se rechazan', async () => {
  await assert.rejects(
    () =>
      service.mutate(owner, {
        action: 'createProject',
        name: 'Obra',
        client: 'Cliente',
        budget: '1.000,00',
      }),
    (e) => e.status === 400,
  );
  const p = await project();
  const id = (
    await service.mutate(owner, {
      action: 'createChange',
      projectId: p,
      title: "'); DROP TABLE projects; --",
      description: '<script>alert(1)</script>',
      base: '0,01',
      taxBasisPoints: 2100,
      days: 0,
    })
  ).id;
  assert.equal(row(id).total_cents, 1);
  assert.equal((await service.workspace(owner)).projects.length, 1);
});

test('hash de la versión corresponde al contenido y total mostrado', async () => {
  const p = await project(),
    id = await draft(p),
    token = await send(id),
    c = await service.review(token);
  const snapshot = {
    project: c.project_name,
    client: c.client,
    budgetCents: c.budget_cents,
    title: c.title,
    description: c.description,
    baseCents: c.base_cents,
    taxBasisPoints: c.tax_basis_points,
    taxCents: c.tax_cents,
    totalCents: c.total_cents,
    days: c.days,
    revision: c.revision,
    previousCents: c.previous_cents,
    contextVersion: c.context_version,
  };
  assert.equal(await service.hash(JSON.stringify(snapshot)), c.snapshot_hash);
});

test('aprobar incrementa el total mostrado en la siguiente versión', async () => {
  const p = await project(),
    a = await draft(p),
    ta = await send(a);
  await service.decide(ta, await decision(ta));
  const b = await draft(p),
    tb = await send(b),
    view = service.publicView(await service.review(tb));
  assert.equal(view.previousCents, 16940);
  assert.equal(
    view.budgetCents + view.previousCents + view.totalCents,
    1233880,
  );
});

test('fallo de UPDATE no crea eventos de edición ni incrementa versión', async () => {
  const p = await project(),
    id = await draft(p);
  const before = (await service.workspace(owner)).events.length;
  await assert.rejects(
    () =>
      service.mutate(owner, {
        action: 'edit',
        id,
        lockVersion: 99,
        title: 'Cambio',
        description: 'Texto',
        base: '140',
        taxBasisPoints: 2100,
        days: 0,
      }),
    (e) => e.status === 409,
  );
  assert.equal((await service.workspace(owner)).events.length, before);
  assert.equal(
    sqlite.prepare('SELECT version FROM projects WHERE id=?').get(p).version,
    0,
  );
});
