-- Freemium decision reversed (owner decision Q58): the game is free at launch
-- with no supporter tier, paywall or monetization architecture. The dormant
-- entitlement columns added in 0002 are removed.
--
-- Note: any granted premium flags are discarded; nothing was ever paid for.

alter table guests drop column if exists premium;
alter table guests drop column if exists premium_since;
alter table guests drop column if exists premium_code;
