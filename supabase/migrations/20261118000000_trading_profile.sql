-- The three first questions (docs/plans/offer-overhaul.md item 3, Ben 2026-11-17): the member's account size, how much of
-- it they'll risk on one trade, and their style. Every idea, plan and size reads them (src/lib/tradingProfile.ts).
-- Members write their own through the column grants below; the row's own policy keeps it to their row.
alter table public.profiles
  add column if not exists account_size numeric check (account_size is null or (account_size >= 100 and account_size <= 100000000)),
  add column if not exists risk_pct numeric check (risk_pct is null or (risk_pct > 0 and risk_pct <= 10)),
  add column if not exists trade_style text check (trade_style is null or trade_style in ('day', 'swing', 'long')),
  add column if not exists onboarded_at timestamptz;

grant update (account_size, risk_pct, trade_style, onboarded_at) on public.profiles to authenticated;
