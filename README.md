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
