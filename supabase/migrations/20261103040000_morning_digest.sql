-- The morning email (piece 5 of the trade-ideas plan, Ben 2026-11-02: "Email digest"): every member gets the day's ideas
-- and their watchlist's unless they switch it off (Settings, or the email's one-click unsubscribe). Written by the
-- server only (service role), as profiles' plan columns are.
alter table public.profiles add column if not exists digest_email boolean not null default true;
