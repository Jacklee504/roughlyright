-- 0001_init.sql — Roughly Right shared schema (Estimation v1, rules version 1)
-- Postgres dialect. Dates are UTC calendar dates; timestamps are timestamptz (UTC).

create table guests (
  id text primary key,
  created_at timestamptz not null default now()
);

create table games (
  slug text primary key,
  name text not null,
  rules_version text not null,
  launch_date date,
  disabled boolean not null default false
);

create table target_datasets (
  id text primary key,
  game_slug text not null references games(slug),
  name text not null,
  unit text not null,
  revision text not null,
  eligible_scope text
);

create table target_entries (
  dataset_id text not null references target_datasets(id),
  entry_id text not null,
  label text not null,
  disambiguator text,
  value text not null,          -- exact decimal string, dataset unit
  source jsonb not null,        -- { title, url?, note? }
  aliases text[] not null default '{}',
  primary key (dataset_id, entry_id)
);

create table target_lookup (
  dataset_id text not null,
  entry_id text not null,
  kind text not null,           -- 'label' | 'alias'
  norm_key text not null,       -- normalized comparison key
  primary key (dataset_id, norm_key, kind, entry_id)
);
create index target_lookup_prefix on target_lookup (dataset_id, norm_key text_pattern_ops);

create table prompt_revisions (
  revision_id uuid primary key,
  prompt_id text not null,
  game_slug text not null references games(slug),
  round_type text not null,     -- 'direct_fact' | 'calculation' | 'target_match'
  category text not null,
  prompt_text text not null,
  scope text,
  unit text not null,           -- displayed answer unit, shown outside the input
  count_mode boolean not null default false,
  hint jsonb,                   -- optional, server-supplied only
  private jsonb not null,       -- scoring record; NEVER serialized to the client
  reveal jsonb not null,        -- public reveal record
  quality text not null,        -- 'fixture' | 'live'
  status text not null,         -- 'live' | 'unpublished'
  created_at timestamptz not null default now()
);

create table puzzles (
  id uuid primary key,
  game_slug text not null references games(slug),
  date date not null,
  display_number int not null,
  theme_tag text,
  content_revision text not null,
  rules_version text not null,
  status text not null,         -- 'live' | 'unpublished'
  prompt_revision_ids uuid[] not null,
  created_at timestamptz not null default now(),
  unique (game_slug, date)
);

create table attempts (
  id uuid primary key,
  guest_id text not null references guests(id),
  puzzle_id uuid not null references puzzles(id),
  mode text not null,           -- 'daily' | 'archive'
  state text not null,          -- 'active' | 'completed' | 'expired'
  current_ordinal smallint not null default 1,
  started_at timestamptz not null,
  completed_at timestamptz,
  completion_date date,         -- UTC date credited for streaks
  daily_expiry timestamptz,     -- ranked daily finish window (00:30 UTC next day)
  score int not null default 0,
  unique (guest_id, puzzle_id, mode)
);

create table attempt_rounds (
  attempt_id uuid not null references attempts(id),
  ordinal smallint not null,
  revision_id uuid not null references prompt_revisions(revision_id),
  opened_at timestamptz not null,
  deadline timestamptz,         -- unused in v1 (untimed); kept per contract
  outcome text,                 -- 'scored' | 'pass'
  submitted_value text,         -- canonical decimal string, numeric rounds
  submitted_entity jsonb,       -- { entryId, label, value } target rounds
  points int,
  mark text,                    -- Exact | Close | In range | Far | Pass
  error_factor text,            -- canonical decimal string of max/min
  request_id text,
  resolved_at timestamptz,
  primary key (attempt_id, ordinal)
);
create unique index attempt_round_request on attempt_rounds (attempt_id, request_id)
  where request_id is not null;

create table share_results (
  token text primary key,
  attempt_id uuid not null references attempts(id),
  comparison boolean not null default false,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table content_reports (
  id uuid primary key,
  revision_id uuid not null,
  reason text not null,
  proposed_answer text,
  url text,
  created_at timestamptz not null default now(),
  status text not null default 'open'
);

create table site_events (
  day date not null,
  game_slug text not null,
  event text not null,          -- start | round_resolved | completion | share | report | theme_tag
  detail text,
  count int not null default 0,
  primary key (day, game_slug, event, detail)
);
