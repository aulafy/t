import postgres, { type Sql } from 'postgres';

type Queryable = Pick<Sql, 'unsafe'>;

function positional(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

class PostgresStatement {
  private values: unknown[] = [];

  constructor(
    private readonly db: PostgresD1,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  private execute(client: Queryable = this.db.sql) {
    return client.unsafe(positional(this.query), this.values as never[]);
  }

  async first<T>() {
    const rows = await this.execute();
    return (rows[0] as T | undefined) ?? null;
  }

  async all<T>() {
    const rows = await this.execute();
    return { results: rows as unknown as T[], success: true };
  }

  async run() {
    const rows = await this.execute();
    return { results: rows, success: true, meta: { changes: rows.count } };
  }

  async inTransaction(client: Queryable) {
    const rows = await this.execute(client);
    return { results: rows, success: true, meta: { changes: rows.count } };
  }
}

class PostgresD1 {
  readonly sql: Sql;

  constructor(url: string) {
    this.sql = postgres(url, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      types: {
        bigint: { to: 20, from: [20], serialize: String, parse: Number },
      },
    });
  }

  prepare(query: string) {
    return new PostgresStatement(this, query);
  }

  async batch(statements: PostgresStatement[]) {
    return this.sql.begin((transaction) =>
      Promise.all(statements.map((statement) => statement.inTransaction(transaction))),
    );
  }
}

let database: PostgresD1 | undefined;

export function getPostgresD1() {
  const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Configura SUPABASE_DB_URL en las variables de Vercel.');
  return (database ??= new PostgresD1(url));
}
