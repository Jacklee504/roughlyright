import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Database access — dual mode, same interface everywhere:
 *
 * - `DATABASE_URL` set → hosted PostgreSQL via `pg` (Netlify/serverless
 *   friendly; migrations are applied explicitly with `npm run db:migrate`,
 *   never implicitly at boot).
 * - otherwise → embedded PGlite (WASM Postgres) on the local filesystem,
 *   for zero-setup local development. `DATABASE_PATH` selects the data
 *   directory (default ./.data/pg); `:memory:` gives a throwaway database.
 *
 * The SQL in migrations/ and every service query is plain Postgres, so the
 * two modes are interchangeable. `Queryable` is the narrow surface services
 * are written against (transaction-aware helpers take a `client` explicitly,
 * which keeps nested queries off the wrong connection).
 */

export type Queryable = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export type Db = Queryable & {
  transaction: <R>(fn: (tx: Queryable) => Promise<R>) => Promise<R>;
};

const DEFAULT_PATH = "./.data/pg";

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? DEFAULT_PATH;
}

export function databaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

function migrationsDir(): string {
  return path.join(process.cwd(), "migrations");
}

export async function applyMigrations(db: Db): Promise<void> {
  await db.query(`create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )`);
  const applied = new Set(
    (await db.query<{ version: string }>("select version from schema_migrations")).rows.map((r) => r.version),
  );
  const dir = migrationsDir();
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".sql")).sort() : [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    await db.transaction(async (tx) => {
      // PGlite runs one statement per prepared query: strip comment lines, then
      // split on statement terminators. (Harmless overhead on hosted Postgres.)
      const body = sql
        .split("\n")
        // Our migration files have no `--` inside string literals, so it is safe
        // to strip line and inline comments before splitting on `;`.
        .map((line) => line.replace(/--.*$/, ""))
        .join("\n");
      for (const statement of splitStatements(body)) {
        await tx.query(statement);
      }
      await tx.query("insert into schema_migrations (version) values ($1)", [file]);
    });
  }
}

/** Splits a SQL file into single statements, keeping comments attached to their statement. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") inString = !inString;
    if (c === ";" && !inString) {
      const stmt = current.trim();
      if (stmt && !/^--/.test(stmt.replace(/\n--.*$/gm, "").trim())) out.push(stmt);
      current = "";
      continue;
    }
    current += c;
  }
  const tail = current.trim().replace(/^(?:--[^\n]*\n)+/, "").trim();
  if (tail) out.push(tail);
  return out;
}

// ---------------------------------------------------------------------------
// Mode constructors
// ---------------------------------------------------------------------------

async function createPgliteDatabase(): Promise<Db> {
  const usePath = databasePath();
  if (usePath !== ":memory:") {
    const abs = path.resolve(usePath);
    if (!existsSync(abs)) mkdirSync(abs, { recursive: true });
  }
  const pglite = new PGlite(usePath === ":memory:" ? undefined : usePath);
  await applyMigrations(pglite as unknown as Db); // runtime behaviour matches Db
  return pglite as unknown as Db;
}

function createHostedDatabase(url: string): Db {
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(u.hostname);
  const sslmode = u.searchParams.get("sslmode");
  const ssl = sslmode === "disable" || local ? undefined : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: url, ssl, max: 5 });
  return {
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      const res = await pool.query(sql, params ?? []);
      return { rows: res.rows as T[] };
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        try {
          const result = await fn(client);
          await client.query("commit");
          return result;
        } catch (err) {
          await client.query("rollback");
          throw err;
        }
      } finally {
        client.release();
      }
    },
  };
}

// Singleton (survives Next.js dev module reloads via globalThis).
const globalKey = "__roughlyRightDb";
type GlobalWithDb = typeof globalThis & { [globalKey]?: Promise<Db> };

export function getDb(): Promise<Db> {
  const g = globalThis as GlobalWithDb;
  if (!g[globalKey]) {
    const url = databaseUrl();
    g[globalKey] = (url ? Promise.resolve(createHostedDatabase(url)) : createPgliteDatabase()).catch((e) => {
      g[globalKey] = undefined;
      throw e;
    });
  }
  return g[globalKey];
}

export async function q<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  const res = await db.query<T>(sql, params);
  return res.rows;
}
