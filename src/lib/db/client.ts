import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * PGlite is embedded PostgreSQL (WASM). The SQL is plain Postgres, so the same
 * migrations run unchanged against a hosted PostgreSQL when production hosting
 * is chosen. Data lives on disk at DATABASE_PATH (default ./.data/pg);
 * PGlite with no path runs fully in memory (used by tests).
 */

export type Queryable = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

const DEFAULT_PATH = "./.data/pg";

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? DEFAULT_PATH;
}

function migrationsDir(): string {
  return path.join(process.cwd(), "migrations");
}

export async function applyMigrations(db: PGlite): Promise<void> {
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
      // split on statement terminators.
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

export async function createDatabase(): Promise<PGlite> {
  const usePath = databasePath();
  if (usePath !== ":memory:") {
    const abs = path.resolve(usePath);
    if (!existsSync(abs)) mkdirSync(abs, { recursive: true });
    const db = new PGlite(abs);
    await applyMigrations(db);
    return db;
  }
  const db = new PGlite();
  await applyMigrations(db);
  return db;
}

// Singleton (survives Next.js dev module reloads via globalThis).
const globalKey = "__roughlyRightDb";
type GlobalWithDb = typeof globalThis & { [globalKey]?: Promise<PGlite> };

export function getDb(): Promise<PGlite> {
  const g = globalThis as GlobalWithDb;
  if (!g[globalKey]) {
    g[globalKey] = createDatabase().catch((e) => {
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
