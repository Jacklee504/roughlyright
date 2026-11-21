-- Supporter purchases and cosmetics (freemium, switchable per deployment).
-- The tier itself stays on guests.tier (0005). A purchase row records one
-- checkout (mock or Stripe test/live) and the hashed restore code that lets a
-- supporter re-claim the tier on another browser or after clearing cookies.
-- No card data, names or emails are stored here: the payment provider holds
-- those. provider_ref is the provider's checkout/session id.

create table purchases (
  id uuid primary key,
  guest_id text references guests(id) on delete set null,
  provider text not null,
  provider_ref text,
  status text not null default 'pending',
  amount_cents int,
  currency text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  restore_hash text unique,
  restore_uses int not null default 0
);
create index purchases_guest on purchases (guest_id);
create unique index purchases_provider_ref on purchases (provider, provider_ref) where provider_ref is not null;

alter table guests add column theme text not null default 'night';
