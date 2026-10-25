# Highstrike

Marketing site for **Highstrike** — a stock market analytics and data platform.

Built with Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase. Deployed on Vercel.

## Stack

- **Frontend**: Next.js app router, server components, Tailwind v4 theme tokens in `src/app/globals.css`
- **Database**: Supabase (`waitlist_signups` table, RLS: anon insert-only) — migrations in `supabase/migrations/`
- **Market data**: `/api/market` serves live quotes via Finnhub when `FINNHUB_API_KEY` is set, otherwise a clearly-labeled sample set
- **Waitlist**: `/api/waitlist` validates email server-side and inserts through the Supabase publishable key (RLS-gated)

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm run dev
```

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `FINNHUB_API_KEY` | Optional — enables the live market ticker (free at finnhub.io) |

## Database

Migrations live in `supabase/migrations/` and are applied to the `highstrike` Supabase project. The waitlist table allows anonymous INSERT only (no read/update/delete) — signups are read from the Supabase dashboard.

### Running SQL

`npm run sql` runs SQL on the project `NEXT_PUBLIC_SUPABASE_URL` points at, through Supabase's Management API:

```bash
npm run supabase:token                                   # once: save a Supabase access token (macOS dialog)
npm run sql -- "select count(*) from waitlist_signups"
npm run sql -- supabase/migrations/20260827150000_tour_flag.sql
npm run sql -- --read-only "select now()"                # the database refuses anything that writes
```

The token is a personal access token from supabase.com/dashboard/account/tokens. It's kept in the login Keychain (service `Highstrike`), never in the repo or `.env.local`; `SUPABASE_ACCESS_TOKEN` in the environment overrides it.

## Domain and DNS

highstrike.com's DNS is on Cloudflare (nameservers `jerry` and `melany.ns.cloudflare.com`). Vercel serves the site and redirects `highstrike.com` to `www.highstrike.com`, and Google Workspace hosts the support@highstrike.com mailbox. All records are DNS only (grey cloud, not proxied):

| Type | Name | Content | For |
|---|---|---|---|
| A | `@` | `76.76.21.21` | Vercel |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel |
| MX | `@` | `smtp.google.com` (priority 1) | Google Workspace mail |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | SPF: Google may send as highstrike.com |
| TXT | `_dmarc` | `v=DMARC1; p=none` | DMARC, monitoring only |

`npm run dns` lists the zone's records through Cloudflare's API. `npm run dns -- set <type> <name> <content>` adds a record or replaces the one of that type and name, and `npm run dns -- add …` always adds (TXT and MX records can share a name; `--priority <n>` for MX). `npm run cloudflare:token` saves the API token it uses (an "Edit zone DNS" token for highstrike.com) in the login Keychain.
