-- Stripe billing: link profiles to Stripe customers. Written only by the
-- server (service role via webhook/checkout routes) — deliberately NOT in the
-- authenticated column-update grant, so users can't tamper with it.

alter table public.profiles add column if not exists stripe_customer_id text;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id);
