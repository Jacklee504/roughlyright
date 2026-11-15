-- Freemium entitlements. Premium is a per-guest flag granted by redeeming an
-- owner-issued code (PREMIUM_CODES env) or by environment-wide unlock
-- (PREMIUM_ALL=1 for local/dev). Online checkout is a future decision — see
-- OPEN_QUESTIONS.

alter table guests add column premium boolean not null default false;
alter table guests add column premium_since timestamptz;
alter table guests add column premium_code text;
