import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    client: text('client').notNull(),
    budgetCents: integer('budget_cents').notNull(),
    version: integer('version').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('projects_owner').on(t.ownerId)],
);
export const changes = sqliteTable(
  'changes',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    rootId: text('root_id').notNull(),
    revision: integer('revision').notNull().default(1),
    title: text('title').notNull(),
    description: text('description').notNull(),
    baseCents: integer('base_cents').notNull(),
    taxBasisPoints: integer('tax_basis_points').notNull(),
    taxCents: integer('tax_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    days: integer('days').notNull(),
    status: text('status').notNull().default('draft'),
    lockVersion: integer('lock_version').notNull().default(0),
    tokenHash: text('token_hash'),
    expiresAt: text('expires_at'),
    contextVersion: integer('context_version'),
    previousCents: integer('previous_cents'),
    snapshotHash: text('snapshot_hash'),
    decisionKey: text('decision_key'),
    decisionName: text('decision_name'),
    decisionAt: text('decision_at'),
    decisionType: text('decision_type'),
    decisionComment: text('decision_comment'),
    lastOperation: text('last_operation'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('changes_project').on(t.projectId),
    uniqueIndex('changes_token').on(t.tokenHash),
    uniqueIndex('changes_revision').on(t.rootId, t.revision),
  ],
);
export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    changeId: text('change_id')
      .notNull()
      .references(() => changes.id),
    kind: text('kind').notNull(),
    actor: text('actor').notNull(),
    at: text('at').notNull(),
    detail: text('detail').notNull(),
    operationId: text('operation_id').notNull(),
  },
  (t) => [
    index('events_change').on(t.changeId),
    uniqueIndex('events_operation').on(t.operationId),
  ],
);
