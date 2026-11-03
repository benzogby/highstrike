-- HighStrike's membership from 2026-11-03 (Ben: "Make the pricing Try it for a week for $14 and then $99/month
-- thereafter"): $14 for the first 7 days, then $99 a month until it's cancelled, on a Stripe subscription. The $397
-- lifetime offer is gone (nobody bought it); plan 'lifetime' stays only as access an admin grants for free.
--
-- A member is an admin, an account on plan 'monthly' (its subscription is in its week or paid up; the server keeps the
-- plan in step with Stripe, src/lib/billing.ts) or one on plan 'lifetime' (granted). A $99 that fails locks the account
-- at once (Ben: "Lock until paid"): the subscription goes past_due and the plan back to 'free' until a payment goes
-- through.

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.is_admin or p.plan in ('monthly', 'lifetime'))
  );
$$;

-- When the plan was last known good until (the end of the week or of the paid month). A page that finds it past asks
-- Stripe again before letting the account in, so a missed webhook can't leave a lapsed account open.
alter table public.profiles add column if not exists plan_until timestamptz;

-- One row per Stripe subscription, written only by the server (the webhook, the checkout's way back, the pages' check).
create table if not exists public.subscriptions (
  id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  customer text not null,
  email text,
  -- Stripe's status: trialing, active, past_due, unpaid, canceled, incomplete, incomplete_expired, paused.
  status text not null,
  trial_end timestamptz,
  period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  -- The purchase that started it (purchases.payment_intent).
  first_payment text,
  -- How long its state holds without asking Stripe again: the end of the week or month once its latest invoice is paid,
  -- or a couple of hours while an invoice is still waiting to be charged.
  good_until timestamptz,
  -- The last invoice whose failed payment was emailed about, so each failure sends one email.
  failed_invoice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user on public.subscriptions (user_id);
create index if not exists subscriptions_customer on public.subscriptions (customer);
create index if not exists subscriptions_email on public.subscriptions (lower(email));

alter table public.subscriptions enable row level security;

drop policy if exists "read own subscriptions" on public.subscriptions;
create policy "read own subscriptions" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

-- The cards that have had a $14 week (Ben: one week per person, checked by email and by card): Stripe's fingerprint of
-- the card, never its number. Server only: no policies, so nobody reads it through the API.
create table if not exists public.trial_cards (
  fingerprint text primary key,
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  payment_intent text,
  created_at timestamptz not null default now()
);

alter table public.trial_cards enable row level security;

-- Every first payment now: the $14 week, or a first $99 for someone whose week was used, and the account it opened. The
-- $397 table, renamed (it never held a payment). `payment_intent` is Stripe's payment, or the checkout session for
-- Stripe's own page.
alter table if exists public.lifetime_purchases rename to purchases;
alter index if exists public.lifetime_purchases_email rename to purchases_email;
alter table public.purchases add column if not exists kind text not null default 'trial';
alter table public.purchases add column if not exists subscription text;
