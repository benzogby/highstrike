# HighStrike worker

An always-on program that keeps one connection open to Alpaca's free real-time stream (IEX) and records each minute bar for the stocks members look at into `public.live_bars`. The site folds those minutes into its charts (`src/lib/candles.ts`), so intraday charts run right up to now. Alpaca's free history stops 15 minutes back.

## Deploy (Railway)

`npm run worker:deploy` (scripts/railway.mjs) does all of this through Railway's API, with a token saved in the Keychain. It's already set up as project `highstrike-worker`, service `worker`. Run it again to update the settings and redeploy.

By hand:

1. Create a new Railway project from this GitHub repository, with the service's **root directory** set to `worker`. Railway runs `npm start`, which is `node index.mjs` on Node 22, and needs nothing to install.
2. Set these variables on the service:
   - `ALPACA_KEY_ID` and `ALPACA_SECRET`: from the Alpaca dashboard, the same ones saved by `npm run alpaca:key`.
   - `SUPABASE_URL`: the project's URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: the service role key.
3. The service answers `GET /` with its status: connected, last bar, rows written, and how many stocks it watches.

Alpaca's free plan allows one stream connection per account, so run one copy only.
