-- Shared rate-limit counters (Q26, Q49): on hosted Postgres the limiter uses
-- this table so counters are shared across serverless instances. Rows are
-- deleted by the daily job once their window has passed. No raw IP or guest
-- values are stored here beyond the coarse hashed bucket key.
create table rate_limit_hits (
  bucket text primary key,       -- e.g. sha256(network-key)|resolve|<window-index>
  count int not null default 0,
  window_start timestamptz not null
);

-- Invalid-input funnel (Q48): coarse reason codes only, never the rejected
-- text. One row per failed lock-in; corrected_at marks the eventual success
-- of the same attempt round. Granular operational event data: retained 90
-- days (Q23) and purged by the daily job. Not exported via /api/privacy.
create table invalid_guess_events (
  id uuid primary key,
  attempt_id uuid not null references attempts(id) on delete cascade,
  ordinal smallint not null,
  round_type text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  corrected_at timestamptz
);
create index invalid_guess_events_created on invalid_guess_events (created_at);
