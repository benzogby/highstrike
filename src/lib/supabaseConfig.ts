// Supabase connection for the highstrike project. Both values are public
// client-safe credentials (the publishable key ships in the browser bundle by
// design); RLS on the database is the security boundary. Env vars override.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://dobrcbahlbypzvbuwkoe.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_HbSKSebFTzNhHImOxW2QXA_8qaOO96n";
