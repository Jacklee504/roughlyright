/**
 * Integration suite (runs under tsx, not vitest — PGlite's WASM runtime is
 * incompatible with vitest's module runner). Covers the full guest loop,
 * archive, streaks, expiry, sharing and content import against a fresh
 * in-memory Postgres instance.
 */

import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";

process.env.DATABASE_PATH = ":memory:";

const { getDb } = await import("@/lib/db/client");
const { importDirectory, importDataset, ImportError } = await import("@/lib/content/import");
const { startOrResume, resolveRound, advanceRound, getRecapForGuest } = await import("@/lib/service/attempts");
const { getGameStatus } = await import("@/lib/service/status");
const { computeStreaks } = await import("@/lib/service/stats");
const { createShare, getSharePayload, revokeShare } = await import("@/lib/service/share");
const { setClock } = await import("@/lib/domain/clock");
// Pin the suite's calendar. Fixtures import with `dayOffset` relative to
// utcToday(), and the archive/expiry tests reference fixed dates — without a
// pinned clock the whole suite silently drifts (and breaks) on a real-world
// date rollover.
const FIXED_NOW = new Date("2026-11-17T12:00:00Z");
setClock(FIXED_NOW);

type Test = { name: string; fn: () => Promise<void> };
const tests: Test[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

let attemptCounter = 0;
const rid = () => `req-${++attemptCounter}-${Math.random().toString(36).slice(2)}`;

const FIXTURES = path.join(process.cwd(), "content", "fixtures");
let completedDaily = { guest: "", attemptId: "" };

async function newGuest(): Promise<string> {
  const id = "guest-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const db = await getDb();
  await db.query(`insert into guests (id) values ($1)`, [id]);
  return id;
}

async function startDaily(guest: string) {
  const r = await startOrResume(guest, { game: "estimation" });
  if (!r.ok) throw new Error(`start failed: ${r.message}`);
  return r.state;
}

// ---------------------------------------------------------------------------
// Content import + editorial validation
// ---------------------------------------------------------------------------

test("imports the whole fixture set and assigns first-publication numbers", async () => {
  const db = await getDb();
  const result = await importDirectory(db, FIXTURES);
  assert.equal(result.puzzles.length, 4);
  assert.ok(result.datasets.includes("films-fixture"));
  const rows = await db.query<{ date: string; display_number: number }>(
    `select date::text as date, display_number from puzzles where game_slug='estimation' order by date`,
  );
  // B6/Q2: numbers are assigned once at first publication — unique, positive,
  // and never renumbered afterwards (stability is asserted by the idempotent
  // re-import test below).
  const numbers = rows.rows.map((r) => r.display_number);
  assert.deepEqual([...numbers].sort((a, b) => a - b), [1, 2, 3, 4]);
});

test("is idempotent on re-import", async () => {
  const db = await getDb();
  const before = await db.query<{ count: string }>(`select count(*)::text as count from prompt_revisions`);
  await importDirectory(db, FIXTURES);
  const after = await db.query<{ count: string }>(`select count(*)::text as count from prompt_revisions`);
  assert.equal(after.rows[0].count, before.rows[0].count);
});

test("production import rejects fixture content and demands approval metadata", async () => {
  const db = await getDb();
  // Fixtures are never publishable, even passed directly (Q1/C2).
  await assert.rejects(() => importDirectory(db, FIXTURES, { production: true }), ImportError);
  // The live library without approvals.json also cannot publish (Q12).
  const live = path.join(process.cwd(), "content", "live");
  await assert.rejects(() => importDirectory(db, live, { production: true }), /approval/i);
});

test("rejects datasets with colliding aliases", async () => {
  const db = await getDb();
  const { readFileSync, readdirSync } = await import("node:fs");
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json"));
  const dsRaw = files.map((f) => JSON.parse(readFileSync(path.join(FIXTURES, f), "utf8"))).find((j) => j.kind === "target_dataset");
  const ds = JSON.parse(JSON.stringify(dsRaw));
  ds.id = "collide-test";
  ds.entries[1].aliases = ["Paper Mountains"];
  await assert.rejects(() => importDataset(db, { ...ds, game: "estimation" }), ImportError);
});

// ---------------------------------------------------------------------------
// Guest loop
// ---------------------------------------------------------------------------

test("plays the full daily: fact, three calcs, target match, then recap", async () => {
  const guest = await newGuest();
  const s0 = await startDaily(guest);
  const attemptId = s0.attemptId;
  assert.equal(s0.prompt?.roundType, "direct_fact");
  assert.equal(s0.prompt?.unit, "kg");
  assert.ok(s0.expiresAt, "daily finish window armed");

  let r = await resolveRound(guest, { attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "900" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.state.resolved?.points, 100);
    assert.equal(r.state.resolved?.mark, "Close");
    assert.equal(r.state.resolved?.direction, "high"); // 900 > 899
    assert.equal(r.state.resolved?.absoluteGap?.display, "1");
  }

  let a = await advanceRound(guest, { attemptId, ordinal: 1, requestId: rid() });
  assert.ok(a.ok);
  if (a.ok) {
    assert.equal(a.state.ordinal, 2);
    assert.equal(a.state.prompt?.roundType, "calculation");
    assert.equal(a.state.prompt?.countMode, true);
  }

  await resolveRound(guest, { attemptId, ordinal: 2, requestId: rid(), pass: false, guess: "5k" });
  a = await advanceRound(guest, { attemptId, ordinal: 2, requestId: rid() });
  assert.ok(a.ok);

  await resolveRound(guest, { attemptId, ordinal: 3, requestId: rid(), pass: false, guess: "35000" });
  a = await advanceRound(guest, { attemptId, ordinal: 3, requestId: rid() });
  assert.ok(a.ok);

  await resolveRound(guest, { attemptId, ordinal: 4, requestId: rid(), pass: false, guess: "1650000" });
  a = await advanceRound(guest, { attemptId, ordinal: 4, requestId: rid() });
  assert.ok(a.ok);
  if (a.ok) {
    assert.equal(a.state.prompt?.roundType, "target_match");
    assert.equal(a.state.prompt?.hintAvailable, false);
  }

  r = await resolveRound(guest, { attemptId, ordinal: 5, requestId: rid(), pass: false, entity: "harbor lights" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.state.resolved?.entity?.label, "Harbor Lights");
    assert.equal(r.state.resolved?.points, 100);
    assert.equal(r.state.resolved?.mark, "Exact");
    assert.equal(r.state.resolved?.direction, "lower than target");
    assert.deepEqual(
      r.state.resolved?.closest?.entries.map((e) => e.label).sort(),
      ["Harbor Lights", "The Long Crossing"],
    );
    assert.equal(r.state.resolved?.closest?.moreCount, 0);
  }

  a = await advanceRound(guest, { attemptId, ordinal: 5, requestId: rid() });
  assert.ok(a.ok);
  if (a.ok) {
    assert.equal(a.state.state, "completed");
    assert.equal(a.state.recap?.total, 450); // 100 + 100 + 100 + 50 + 100
    assert.equal(a.state.recap?.previousBest, null); // first completed daily
    assert.equal(a.state.recap?.rounds.length, 5);
    assert.equal(a.state.recap?.closestRound?.ordinal, 2); // raw-factor ties break to earliest
  }
  completedDaily = { guest, attemptId };
});

test("recap tracks the previous daily best and the streak across days", async () => {
  const guest = await newGuest();
  // Complete the earlier fixture day (11-16) with passes — zero score.
  setClock(new Date("2026-11-16T12:00:00Z"));
  let s = await startDaily(guest);
  for (let i = 1; i <= 5; i++) {
    await resolveRound(guest, { attemptId: s.attemptId, ordinal: i, requestId: rid(), pass: true });
    await advanceRound(guest, { attemptId: s.attemptId, ordinal: i, requestId: rid() });
  }
  // Next day (11-17) with a real run: previous best should be the zero.
  setClock(new Date("2026-11-17T12:00:00Z"));
  s = await startDaily(guest);
  const guesses = ["900", "5k", "35000", "1650000"];
  for (let i = 1; i <= 4; i++) {
    await resolveRound(guest, { attemptId: s.attemptId, ordinal: i, requestId: rid(), pass: false, guess: guesses[i - 1] });
    await advanceRound(guest, { attemptId: s.attemptId, ordinal: i, requestId: rid() });
  }
  await resolveRound(guest, { attemptId: s.attemptId, ordinal: 5, requestId: rid(), pass: false, entity: "harbor lights" });
  const done = await advanceRound(guest, { attemptId: s.attemptId, ordinal: 5, requestId: rid() });
  assert.ok(done.ok);
  if (done.ok) {
    assert.equal(done.state.recap?.total, 450);
    assert.equal(done.state.recap?.previousBest, 0);
    assert.equal(done.state.recap?.streak?.current, 2);
  }
  setClock(FIXED_NOW);
});

test("privacy: export contains own rounds and share tokens but no answer keys; deletion wipes everything", async () => {
  const { exportGuestData, deleteGuestData } = await import("@/lib/service/privacy");
  const guest = await newGuest();
  const s = await startDaily(guest);
  const attemptId = s.attemptId;
  const r = await resolveRound(guest, { attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "900" });
  assert.ok(r.ok);

  let data = await exportGuestData(guest);
  assert.ok(data);
  if (!data) return;
  assert.equal(data.attempts.length, 1);
  assert.equal(data.attempts[0].rounds.length, 1);
  assert.equal(data.attempts[0].rounds[0].submittedValue, "900");
  // A share link (inserted directly to stay independent of completion) appears in the export.
  const db = await getDb();
  await db.query(`insert into share_results (token, attempt_id) values ('privacy-test-token', $1)`, [attemptId]);
  data = await exportGuestData(guest);
  assert.ok(data);
  if (!data) return;
  assert.equal(data.shareTokens.length, 1);
  assert.ok(data.shareTokens[0].tokenPrefix.startsWith("privacy-"));
  const serialized = JSON.stringify(data);
  // No answer-key material (benchmark values) is exported.
  assert.ok(!serialized.includes("benchmark"));

  const gone = await deleteGuestData(guest);
  assert.ok(gone.ok);
  if (gone.ok) assert.equal(gone.attempts, 1);
  const after = await db.query<{ attempts: string; rounds: string; shares: string; guests: string }>(
    `select (select count(*) from attempts where guest_id = $1)::text as attempts,
            (select count(*) from attempt_rounds r join attempts a on a.id = r.attempt_id where a.guest_id = $1)::text as rounds,
            (select count(*) from share_results s join attempts a on a.id = s.attempt_id where a.guest_id = $1)::text as shares,
            (select count(*) from guests where id = $1)::text as guests`,
    [guest],
  );
  assert.deepEqual(after.rows[0], { attempts: "0", rounds: "0", shares: "0", guests: "0" });
});

test("rejects invalid input without closing the round, and explains the issue", async () => {
  const guest = await newGuest();
  const s = await startDaily(guest);
  const bad = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "5,00" });
  assert.ok(!bad.ok);
  if (!bad.ok) {
    assert.equal(bad.code, "invalid_input");
    assert.match(bad.message, /separators/);
    // Round 1 is a measured quantity, so the decimal-comma reading is offered.
    assert.equal(bad.suggestion, "5.00");
  }
  const stillOpen = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "899" });
  assert.ok(stillOpen.ok);
  if (stillOpen.ok) {
    assert.equal(stillOpen.state.resolved?.guess?.canonical, "899");
    assert.equal(stillOpen.state.resolved?.points, 100);
  }
});

test("offers an autocorrect suggestion for a numeric typo; applying it scores normally", async () => {
  const guest = await newGuest();
  const s = await startDaily(guest);
  const typo = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "9oo" });
  assert.ok(!typo.ok);
  if (!typo.ok) {
    assert.equal(typo.code, "invalid_input");
    assert.equal(typo.suggestion, "900");
  }
  // The round is still open; the corrected value resolves normally.
  const applied = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "900" });
  assert.ok(applied.ok);
  if (applied.ok) assert.equal(applied.state.resolved?.points, 100);
});

test("fuzzy-matches a mistyped entity and offers the correction; ambiguous typos get none", async () => {
  const guest = await newGuest();
  const s = await startDaily(guest);
  for (let i = 1; i <= 4; i++) {
    await resolveRound(guest, { attemptId: s.attemptId, ordinal: i, requestId: rid(), pass: true });
    await advanceRound(guest, { attemptId: s.attemptId, ordinal: i, requestId: rid() });
  }
  const typo = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 5, requestId: rid(), pass: false, entity: "harbr lights" });
  assert.ok(!typo.ok);
  if (!typo.ok) {
    assert.equal(typo.code, "invalid_input");
    assert.equal(typo.suggestion, "Harbor Lights");
  }
  const applied = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 5, requestId: rid(), pass: false, entity: "Harbor Lights" });
  assert.ok(applied.ok);
  if (applied.ok) {
    assert.equal(applied.state.resolved?.mark, "Exact");
    assert.equal(applied.state.resolved?.points, 100);
  }
  // A typo equally close to two different entries must not be guessed.
  const g2 = await newGuest();
  const s2 = await startDaily(g2);
  for (let i = 1; i <= 4; i++) {
    await resolveRound(g2, { attemptId: s2.attemptId, ordinal: i, requestId: rid(), pass: true });
    await advanceRound(g2, { attemptId: s2.attemptId, ordinal: i, requestId: rid() });
  }
  const ambiguous = await resolveRound(g2, { attemptId: s2.attemptId, ordinal: 5, requestId: rid(), pass: false, entity: "harbor" });
  assert.ok(!ambiguous.ok);
  if (!ambiguous.ok) assert.equal(ambiguous.suggestion, undefined);
});

test("count mode rejects non-whole guesses after expansion", async () => {
  const guest = await newGuest();
  const s = await startDaily(guest);
  await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "899" });
  await advanceRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid() });
  const countBad = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 2, requestId: rid(), pass: false, guess: "5000.5" });
  assert.ok(!countBad.ok);
  if (!countBad.ok) assert.match(countBad.message, /whole/);
});

test("pass resolves for zero and shows the same explanation", async () => {
  const guest = await newGuest();
  const s = await startDaily(guest);
  const r = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: true });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.state.resolved?.mark, "Pass");
    assert.equal(r.state.resolved?.points, 0);
    assert.equal(r.state.resolved?.guess, null);
    assert.ok(r.state.resolved?.reveal.explanation);
  }
});

test("duplicated submissions return the original outcome; a conflicting guess cannot alter it", async () => {
  const guest = await newGuest();
  const s = await startDaily(guest);
  const first = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: "same-req", pass: false, guess: "899" });
  assert.ok(first.ok);
  const retry = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: "same-req", pass: false, guess: "899" });
  assert.ok(retry.ok);
  const conflict = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "123" });
  assert.ok(conflict.ok); // returns saved state, cannot alter
  if (conflict.ok) {
    assert.equal(conflict.state.resolved?.guess?.canonical, "899");
    assert.equal(conflict.state.score, 100);
  }
});

test("a refresh after submit restores committed state; advancing twice never double-advances", async () => {
  const guest = await newGuest();
  const s = await startDaily(guest);
  await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: true });
  const refreshed = await startOrResume(guest, { game: "estimation" });
  assert.ok(refreshed.ok);
  if (refreshed.ok) {
    assert.equal(refreshed.state.attemptId, s.attemptId);
    assert.equal(refreshed.state.resolved?.mark, "Pass"); // resolved round waits for Next
    assert.equal(refreshed.state.prompt?.ordinal, 1);
  }
  const adv1 = await advanceRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: "adv-req" });
  assert.ok(adv1.ok);
  if (adv1.ok) assert.equal(adv1.state.ordinal, 2);
  const adv2 = await advanceRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: "adv-req" });
  assert.ok(adv2.ok);
  if (adv2.ok) assert.equal(adv2.state.ordinal, 2);
  const adv3 = await advanceRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid() });
  if (adv3.ok) assert.equal(adv3.state.ordinal, 2);
  const stale = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: true });
  assert.ok(!stale.ok);
  if (!stale.ok) assert.equal(stale.code, "stale");
});

test("wrong guest cannot resolve another guest's attempt", async () => {
  const owner = await newGuest();
  const other = await newGuest();
  const s = await startDaily(owner);
  const wrong = await resolveRound(other, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "899" });
  assert.ok(!wrong.ok);
  if (!wrong.ok) assert.equal(wrong.code, "wrong_guest");
});

test("double-clicking start returns the same attempt", async () => {
  const guest = await newGuest();
  const s1 = await startDaily(guest);
  const s2 = await startOrResume(guest, { game: "estimation" });
  assert.ok(s2.ok);
  if (s2.ok) assert.equal(s2.state.attemptId, s1.attemptId);
});

test("home status never creates an attempt and reports availability", async () => {
  const status = await getGameStatus("estimation", await newGuest());
  assert.equal(status.puzzleAvailable, true);
  assert.equal(status.attempt?.exists, false);
  // Today's puzzle (live library or fixtures) is dated today with a positive number.
  const { utcToday } = await import("@/lib/domain/calendar");
  assert.equal(status.date, utcToday());
  assert.ok((status.puzzleNumber ?? 0) >= 1);
});

// ---------------------------------------------------------------------------
// Archive and streaks
// ---------------------------------------------------------------------------

test("a missed date replays unranked and never affects the daily streak", async () => {
  const guest = await newGuest();
  const arch = await startOrResume(guest, { game: "estimation", date: "2026-11-14", mode: "archive" });
  assert.ok(arch.ok);
  if (arch.ok) {
    assert.equal(arch.state.mode, "archive");
    assert.equal(arch.state.puzzleDate, "2026-11-14");
    for (let i = 1; i <= 5; i++) {
      await resolveRound(guest, { attemptId: arch.state.attemptId, ordinal: i, requestId: rid(), pass: true });
      await advanceRound(guest, { attemptId: arch.state.attemptId, ordinal: i, requestId: rid() });
    }
  }
  const streaks = await computeStreaks("estimation", guest);
  assert.equal(streaks.current, 0); // archive never counts
  assert.equal(streaks.best, 0);
});

test("late completion within the finish window credits the original day", async () => {
  const guest = await newGuest();
  setClock(new Date("2026-11-15T23:50:00Z"));
  const s = await startDaily(guest);
  assert.equal(s.puzzleDate, "2026-11-15");
  for (let i = 1; i <= 4; i++) {
    await resolveRound(guest, { attemptId: s.attemptId, ordinal: i, requestId: rid(), pass: true });
    await advanceRound(guest, { attemptId: s.attemptId, ordinal: i, requestId: rid() });
  }
  // Cross into 2026-11-16 — still inside the 30-minute finish window.
  setClock(new Date("2026-11-16T00:10:00Z"));
  await resolveRound(guest, { attemptId: s.attemptId, ordinal: 5, requestId: rid(), pass: true });
  const fin = await advanceRound(guest, { attemptId: s.attemptId, ordinal: 5, requestId: rid() });
  assert.ok(fin.ok);
  const db = await getDb();
  const row = await db.query<{ completion_date: string }>(
    `select completion_date::text as completion_date from attempts where id = $1`,
    [s.attemptId],
  );
  assert.equal(row.rows[0].completion_date, "2026-11-15");
  setClock(new Date("2026-11-16T02:00:00Z"));
  const streaks = await computeStreaks("estimation", guest);
  assert.equal(streaks.current, 1);
  assert.equal(streaks.best, 1);
  setClock(new Date("2026-11-15T12:00:00Z"));
});

test("expiry freezes the ranked record as incomplete and offers an unranked replay", async () => {
  const guest = await newGuest();
  setClock(new Date("2026-11-15T23:50:00Z"));
  const s = await startDaily(guest);
  await resolveRound(guest, { attemptId: s.attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "899" });
  setClock(new Date("2026-11-16T01:00:00Z")); // past the 00:30 window
  const r = await resolveRound(guest, { attemptId: s.attemptId, ordinal: 2, requestId: rid(), pass: false, guess: "5k" });
  assert.ok(!r.ok);
  if (!r.ok) assert.equal(r.code, "expired");
  const db = await getDb();
  const row = await db.query<{ state: string }>(`select state from attempts where id = $1`, [s.attemptId]);
  assert.equal(row.rows[0].state, "expired");
  const resumed = await startOrResume(guest, { game: "estimation", date: "2026-11-15", mode: "archive" });
  assert.ok(resumed.ok);
  if (resumed.ok) assert.equal(resumed.state.mode, "archive");
  setClock(new Date("2026-11-15T12:00:00Z"));
});

test("future dates are unavailable; missing dates never fall back to yesterday's puzzle", async () => {
  setClock(new Date("2026-11-15T12:00:00Z"));
  const future = await startOrResume(await newGuest(), { game: "estimation", date: "2026-11-20" });
  assert.ok(!future.ok);
  if (!future.ok) assert.equal(future.code, "unavailable");
  const missing = await startOrResume(await newGuest(), { game: "estimation", date: "2026-01-01" });
  assert.ok(!missing.ok);
  if (!missing.ok) assert.equal(missing.code, "unavailable");
});

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

test("creates a spoiler-free payload; comparison needs same-puzzle completion; revocation is neutral", async () => {
  const { guest, attemptId } = completedDaily;
  assert.ok(guest, "previous test must have completed a daily");
  const recap = await getRecapForGuest(guest, attemptId);
  assert.ok(recap.ok);

  const share = await createShare(guest, attemptId, true);
  assert.ok(share.ok);
  if (!share.ok) return;
  const token = share.token;

  const stranger = await getSharePayload(token, await newGuest(), null);
  assert.ok(stranger.found);
  if (stranger.found) {
    assert.equal(stranger.payload.total, 450);
    assert.equal(stranger.payload.marks.length, 5);
    const blob = JSON.stringify(stranger.payload);
    assert.ok(!blob.includes("Curiosity"), "no prompts in share payload");
    assert.ok(!blob.includes("899"), "no answers in share payload");
    assert.ok(!blob.includes("Worked estimate"), "no solution steps in share payload");
    assert.equal(stranger.payload.comparison, null);
  }

  const owner = await getSharePayload(token, guest, await completedPuzzleId(attemptId));
  assert.ok(owner.found);
  if (owner.found) assert.equal(owner.payload.comparison?.length, 5);

  const revoked = await revokeShare(guest, token);
  assert.ok(revoked.ok);
  const gone = await getSharePayload(token, guest, null);
  assert.equal(gone.found, false);
});

test("unknown or invalid tokens return a neutral not-found", async () => {
  const gone = await getSharePayload("definitely-not-a-token", null, null);
  assert.equal(gone.found, false);
});

test("invalid-input funnel logs coarse reasons only, never the rejected text, and marks corrections (Q48)", async () => {
  const guest = await newGuest();
  const s0 = await startDaily(guest);
  const attemptId = s0.attemptId;
  // Rounds 1–4: quick pass-through of a numeric round with a bad guess first.
  const bad = await resolveRound(guest, { attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "abc" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.code, "invalid_input");
  const good = await resolveRound(guest, { attemptId, ordinal: 1, requestId: rid(), pass: false, guess: "900" });
  assert.ok(good.ok);
  await advanceRound(guest, { attemptId, ordinal: 1, requestId: rid() });
  for (const o of [2, 3, 4]) {
    await resolveRound(guest, { attemptId, ordinal: o, requestId: rid(), pass: true });
    await advanceRound(guest, { attemptId, ordinal: o, requestId: rid() });
  }
  // Target-match round: empty then unmatchable entity, then a match.
  const empty = await resolveRound(guest, { attemptId, ordinal: 5, requestId: rid(), pass: false, entity: "   " });
  assert.equal(empty.ok, false);
  const nomatch = await resolveRound(guest, { attemptId, ordinal: 5, requestId: rid(), pass: false, entity: "zzzunmatchable" });
  assert.equal(nomatch.ok, false);
  const match = await resolveRound(guest, { attemptId, ordinal: 5, requestId: rid(), pass: false, entity: "harbor lights" });
  assert.ok(match.ok);

  const db = await getDb();
  const events = await db.query<{ reason: string; round_type: string; corrected: boolean; attempt_id: string }>(
    `select reason, round_type, (corrected_at is not null) as corrected, attempt_id
     from invalid_guess_events where attempt_id = $1 order by created_at`,
    [attemptId],
  );
  const reasons = events.rows.map((r) => r.reason);
  assert.deepEqual(reasons, ["parse_error", "empty_entity", "no_match"]);
  assert.ok(events.rows.every((r) => r.attempt_id === attemptId));
  assert.ok(events.rows.every((r) => r.corrected), "all three were corrected by the eventual success");
});

async function completedPuzzleId(attemptId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.query<{ puzzle_id: string }>(`select puzzle_id from attempts where id = $1`, [attemptId]);
  return rows.rows[0]?.puzzle_id ?? null;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (e) {
    failed++;
    console.error(`  × ${t.name}`);
    console.error(e);
  }
}
console.log(`\nIntegration: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
