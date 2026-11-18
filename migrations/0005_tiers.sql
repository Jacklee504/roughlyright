-- Freemium tier plumbing (owner decision: free at launch, supporter tier
-- switchable later without another rewrite). The column is neutral data —
-- nothing is gated on it yet; feature gates live in src/lib/service/tiers.ts.
-- Codes for granting the supporter tier come from the SUPPORTER_CODES env
-- (owner-issued); checkout is a future decision and untouched here.

alter table guests add column tier text not null default 'free';
alter table guests add column tier_since timestamptz;
