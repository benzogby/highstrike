-- Admin → Inbox (Ben, 2026-11-17: "Build full inbox functionality into the admin panel of highstrike.com … send and
-- receive mail as both ben@ and support@"), ported from getripping.com's Inbox: the highstrike.com Google Workspace mailbox
-- (one seat, ben@highstrike.com; support@ is a group that delivers to it and a Send mail as address on it), read and sent
-- through the Gmail API from the server alone (features/inbox). One row: the private ("Internal") Google app made for it
-- under highstrike.com (its client id, and its secret encrypted with TOKEN_ENCRYPTION_KEY), and the refresh token from the
-- one Connect, encrypted the same way. Service role only: RLS with no policies, so nothing here reaches a browser.
create table if not exists public.inbox_gmail (
  id text primary key default 'gmail' check (id = 'gmail'),
  client_id text,
  client_secret_enc text,
  refresh_token_enc text,
  email text,
  scope text,
  connected_at timestamptz,
  error text,
  unsubscribe_after timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.inbox_gmail enable row level security;
revoke all on public.inbox_gmail from anon, authenticated;
comment on table public.inbox_gmail is 'Admin → Inbox: the Google app (client id, encrypted secret) and the encrypted refresh token for the highstrike.com Gmail mailbox. Service role only.';
