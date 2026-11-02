-- Admin → Emails and Admin → Errors (ported from getripping.com's admin, 2026-11-02). Both are written and read only with
-- the service role (src/lib/mail.ts and src/lib/capture.ts write; the admin pages read), so RLS is on with no policies.

create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  to_address text not null,
  from_address text,
  subject text not null,
  kind text,                -- what sent it: sale_alert, payment, price_alert, ...
  html text,                -- what went out, for the admin's look at it
  status text not null,     -- sent | failed
  error text,
  resend_id text
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;

create table if not exists public.error_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null,     -- server | route | client
  message text not null,
  stack text,
  path text,
  digest text,
  user_id uuid
);
create index if not exists error_reports_created_idx on public.error_reports (created_at desc);
alter table public.error_reports enable row level security;
