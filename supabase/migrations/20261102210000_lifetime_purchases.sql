-- Every $397 payment and the account it opened (Ben, 2026-11-02: "Lifetime access should just open to the payment
-- popup. Account is created upon payment, with a confirmation email sent to their email. If they already have an
-- account under that email, they get upgraded when they pay").
--
-- One row per Stripe payment, written only by the server's service key (src/lib/lifetime.ts → settleLifetime). The
-- browser's way back, the webhook and the paywall can all settle the same payment, and the row keeps them from making
-- two accounts, sending two emails or signing a buyer in twice. Admins can read it.

create table if not exists public.lifetime_purchases (
  payment_intent text primary key,
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  amount_cents integer not null,
  -- The payment made this account (rather than upgrading one that was there).
  created_account boolean not null default false,
  -- The one automatic sign-in a new account gets in the browser that paid.
  signed_in_at timestamptz,
  -- The confirmation email: when it was sent, or why it couldn't be.
  emailed_at timestamptz,
  email_error text,
  created_at timestamptz not null default now()
);

create index if not exists lifetime_purchases_email on public.lifetime_purchases (lower(email));

alter table public.lifetime_purchases enable row level security;

drop policy if exists "admins read purchases" on public.lifetime_purchases;
create policy "admins read purchases" on public.lifetime_purchases
  for select to authenticated using ((select public.is_admin()));
