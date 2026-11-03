-- Each idea's option (Ben, 2026-11-03: "each idea gets a suggested option contract, estimated from the stock's own
-- volatility, marked est."): the contract, its estimated price, breakeven and value at the target, worked out by the
-- rules in src/lib/optionIdea.ts when the idea is made. Null when the stock hasn't enough price history.
--
-- Additive only. The view house_setups was made with `select *`, which Postgres expands to the columns the table had
-- then, so it keeps exactly its columns and the public homepage's security-definer functions that read it are unchanged.

alter table public.setups add column if not exists option jsonb;

comment on column public.setups.option is
  'The idea''s option, estimated from the stock''s own daily closes (src/lib/optionIdea.ts OptionIdea): kind, strike(s), expiry, est. premium per share, breakeven, value at the target. Null when there wasn''t enough history.';
