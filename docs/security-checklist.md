# HighStrike security checklist

Reviewed and completed 2026-11-20. Re-run it after any new route, table, bucket or admin tab.
How to check each item is in brackets.

## 1. Admin access

- [x] Every admin page checks for an admin itself, not only `admin/layout.tsx`. Next.js can render a page without the layout above it. Fixed: Traffic, Content, Team, Site, Onboarding and Trading School now call `requireAdmin()`. Non-admins get a 404. [`grep -L requireAdmin src/app/(app)/admin/**/page.tsx` lists only the Inbox page, which uses `isAdminViewer`.]
- [x] Every `/api/admin/*` route checks for an admin: the education routes through `adminContext()`, traffic through its own check, and the inbox routes through `founderOnly`/`jsonRoute`.
- [x] Every admin server action checks for an admin: `setupActions`, `accounts/actions`, `saleAlert`, `scanner/actions` and the inbox actions (`requireFounder`).
- [x] Admin tabs that write from the browser (Team, Site, Content, Onboarding) are guarded by RLS. Only `is_admin()` can write `team_members`, `site_settings` and the `site-assets` bucket.
- [x] Nobody can make themselves an admin or a member. Signed-in users can update only harmless profile columns (name, bio, avatar_url, tour_done, account_size, risk_pct, trade_style, onboarded_at). `is_admin`, `plan` and `stripe_customer_id` are locked. [`has_column_privilege('authenticated','public.profiles',…,'UPDATE')`]

## 2. Members' data

- [x] RLS is on for every table in `public`. Policies scope personal rows to `auth.uid()` (strategies, backtests, trades, paper, watchlists, alerts, notifications). Tables with no policy can only be reached with the service role.
- [x] Every member API route and server action checks the caller (`viewer()`, `requireMember`, `getUser`) before reading or writing.
- [x] Paper orders are filled by the server (`lib/paper.ts`), so fills can't be faked from the browser.

## 3. Throttling (`src/lib/security.ts`)

- [x] There's a shared limiter, `throttle()` for routes and `allow()` for server actions. Each instance keeps a fast window in memory. Public writes and anything that calls a paid API also use a durable window in Postgres (`rate_hit`), so the limit holds across all servers. If the database can't answer, the limiter lets requests through so the site stays up.
- [x] Public routes (limits per IP address):
  - waitlist: 8 per hour
  - report-error: 20 per 10 minutes
  - track: 120 per minute
  - landing lookup: 30 per minute
  - quotes: 60 per minute
  - market: 60 per minute
  - symbol search: 60 per minute
  - unsubscribe: 20 per minute
  - auth callback: 30 per 5 minutes
- [x] Billing routes:
  - start: 10 per 10 minutes for POST, 60 per minute for GET
  - complete: 30 per 10 minutes
  - portal: 20 per 10 minutes
  - pay: 20 per 10 minutes
- [x] Member routes (per instance): candles and live 600 per minute; chain, contract, sparklines, notifications and lesson stream 300–600 per minute; paper 300 per minute; scanner 120 per minute.
- [x] Admin routes: traffic 60 per minute; education 120 per minute; inbox already had `rateGuard`.
- [x] Heavy server actions (per user):
  - backtest: 20 per minute
  - strike preview: 90 per minute
  - paper order: 60 per minute
  - paper reset: 5 per 10 minutes
  - idea builder: 20 per minute
  - scan refresh: 3 per 5 minutes
- [x] Sign-in, sign-up, OTP and password reset are rate limited by Supabase Auth itself: 30 verifications and 100 emails per hour.
- [x] The waitlist and page views can't be written straight through Supabase's REST API with the public key any more. Only the rate-limited server routes write them, using the service role.

## 4. Cron jobs

- [x] Cron routes require `Authorization: Bearer $CRON_SECRET` (`isCron()`, compared in constant time) and fail closed without it. Before this, any request with the user-agent `vercel-cron` ran them, and a test from outside returned 200.
- [x] `CRON_SECRET` is set in Vercel (Production). It's 64 random hex characters and was never printed or committed.
- [x] The chained morning jobs use an HMAC token tied to the day (`morningToken`). Admin "Generate now" needs an admin session.

## 5. Redirects and input

- [x] Every post-sign-in redirect goes through `safeNext()` (`src/lib/safeNext.ts`): the auth callback, the sign-in page and the billing return path. It blocks `//host`, `/\host`, schemes and control characters. Before this, the callback allowed `/\evil.com` and the sign-in page used `next` unchecked.
- [x] Symbol search strips filter syntax before building the PostgREST `or()` filter. Before this, a query like `a,ticker.eq.x)` could add filters of its own.
- [x] Inputs are checked on the server: tickers by regex, ids as UUIDs, body sizes capped, the digest switch coerced to a boolean.
- [x] The inbox image proxy refuses private, loopback, link-local and metadata addresses (including through DNS and redirects), allows images only and caps size at 8 MB.
- [x] Lesson streaming accepts only safe relative paths inside the lesson's own folder, and signs URLs for 6 hours.
- [x] Mailbox HTML is shown in a sandboxed iframe, and files are served with `sandbox` CSP and `nosniff`.

## 6. Headers (`next.config.ts`)

- [x] `Strict-Transport-Security` for 2 years, including subdomains, with preload.
- [x] `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'`.
- [x] CSP also sets `base-uri 'self'`, `object-src 'none'`, `form-action` limited to self, Stripe Checkout and Google, and `upgrade-insecure-requests`.
- [x] `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that switches off camera, microphone, geolocation, USB, serial, Bluetooth, HID and topics.
- [x] `Cross-Origin-Opener-Policy: same-origin-allow-popups`, which keeps the Gmail and "Show original" popups working.
- [x] The `X-Powered-By` header is removed.
- [ ] Full script-src CSP with nonces. Not done: it needs a nonce in the proxy and checking against Stripe, Supabase and YouTube. Follow-up.

## 7. Secrets

- [x] No server secret has a `NEXT_PUBLIC_` name. The only public values are the site URL, the Supabase URL, the publishable key, the Stripe publishable key and an email flag.
- [x] Service-role, Stripe, Alpaca, Finnhub, Massive and Resend keys are read only in server code (route handlers, server actions and `lib/` modules imported by them).
- [x] Gmail OAuth: the client secret and refresh token are stored AES-256-GCM encrypted in `inbox_gmail`, which only the service role can read. The OAuth `state` is checked against an httpOnly cookie, and only highstrike.com accounts are accepted.
- [x] The Stripe webhook verifies the signature (`constructEvent`).
- [x] Unsubscribe links are HMAC-signed and compared in constant time.

## 8. Accounts (Supabase Auth)

- [x] Public sign-ups are off (`disable_signup`) while HighStrike is waitlist-only. Accounts are made only by paid checkout (admin API) or by an admin.
- [x] Passwords need at least 8 characters with letters and numbers, and leaked-password checking (HaveIBeenPwned) is on.
- [x] Refresh-token rotation is on and JWTs expire after 1 hour. Changing an email needs confirmation on both addresses.
- [x] Redirect allow-list: only `www.highstrike.com/auth/callback` and the project's own `highstrike-one.vercel.app`.
- [x] Database functions: `handle_new_user` can't be called. The membership checks can't be called by anonymous visitors. The homepage's `get_landing_*` and `education_summary` stay public on purpose.

## 9. Storage

- [x] `avatars` (public): members write only to their own folder, at most 5 MB, PNG/JPEG/WebP/GIF only (no SVG).
- [x] `site-assets` (public): admins only, at most 10 MB, image types only.
- [x] `lessons` (private): members with Trading School read through signed URLs, and admins write. Limited to 50 MB and a type allow-list.

## 10. Dependencies

- [x] `npm audit` reports 0 vulnerabilities. Next.js went from 16.3.1 to 16.4.6, which closes three critical RCE advisories, and sharp, zod and source-map-js were updated.
- [ ] Run `npm audit` monthly and after every dependency change.

## 11. Payments

- [x] New memberships are refused on the server while `WAITLIST_ONLY` is on (`/api/billing/start` returns 403).
- [x] Payment amounts come from the server (`lib/offer.ts`), never from the browser.

## Follow-ups (not done today)

- A full nonce-based Content-Security-Policy (`script-src`).
- MFA for admin accounts. Supabase TOTP is available, but the app has no enrolment screen.
- Vercel Firewall rate-limit rules as an extra layer in front of the app. These are set in the Vercel dashboard.
