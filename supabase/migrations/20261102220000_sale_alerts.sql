-- The sale alert Ben gets for each $397 payment (src/lib/saleAlert.ts): when it went out, once per payment, or why it
-- couldn't (no RESEND_API_KEY, Resend turned it down). Written by the server's service key only, like the rest of the row.
alter table public.lifetime_purchases add column if not exists alerted_at timestamptz;
alter table public.lifetime_purchases add column if not exists alert_error text;
