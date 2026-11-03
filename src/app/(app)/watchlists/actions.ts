"use server";

import { revalidatePath } from "next/cache";
import { viewer } from "@/lib/membership";
import { ensureSymbol } from "@/lib/symbols";
import { LIST_SIZE, MAX_LISTS, NAME_MAX, STARTERS } from "@/lib/watchlists";

// What the Watchlists page changes (Ben, 2026-11-03: Watchlists gets its own page). Each one checks the member and that
// the list is theirs before it writes, writes as the member (the tables' RLS still holds), then refreshes /watchlists
// and Home, so the page that asked comes back with the change in the same answer.

export type Done = { ok: true; id?: string } | { error: string };

const LIST_ID = /^[0-9a-f-]{36}$/i;
const TICKER = /^[A-Z][A-Z.-]{0,9}$/;

const clean = (name: unknown) => (typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) : "");
const tickerOf = (raw: unknown) => (typeof raw === "string" ? raw.trim().toUpperCase().replace(/^\$/, "") : "");

async function member() {
  const v = await viewer();
  return v?.member ? v : null;
}
type Member = NonNullable<Awaited<ReturnType<typeof member>>>;

/** The list's id when it's this member's, else null. */
async function own(v: Member, id: unknown): Promise<string | null> {
  if (typeof id !== "string" || !LIST_ID.test(id)) return null;
  const { data } = await v.supabase.from("watchlists").select("id").eq("id", id).eq("user_id", v.user.id).maybeSingle();
  return data ? id : null;
}

function refresh() {
  revalidatePath("/watchlists");
  revalidatePath("/dashboard");
}

const NOT_MEMBER = { error: "Watchlists are for members." };
const NO_LIST = { error: "That list isn't there anymore. Refresh the page." };

export async function createList(name: string): Promise<Done> {
  const v = await member();
  if (!v) return NOT_MEMBER;
  const n = clean(name);
  if (!n) return { error: "Give the list a name." };
  const { count } = await v.supabase.from("watchlists").select("id", { count: "exact", head: true }).eq("user_id", v.user.id);
  if ((count ?? 0) >= MAX_LISTS) return { error: `You have ${MAX_LISTS} lists, the most there can be. Delete one to make another.` };
  const { data, error } = await v.supabase.from("watchlists").insert({ user_id: v.user.id, name: n }).select("id").single();
  if (error || !data) return { error: "Couldn't make the list. Try again." };
  refresh();
  return { ok: true, id: data.id };
}

export async function renameList(id: string, name: string): Promise<Done> {
  const v = await member();
  if (!v) return NOT_MEMBER;
  const n = clean(name);
  if (!n) return { error: "Give the list a name." };
  const { data, error } = await v.supabase.from("watchlists").update({ name: n }).eq("id", id).eq("user_id", v.user.id).select("id");
  if (error) return { error: "Couldn't rename the list. Try again." };
  if (!data?.length) return NO_LIST;
  refresh();
  return { ok: true };
}

/** Deletes a list and its symbols. A member keeps at least one list. */
export async function deleteList(id: string): Promise<Done> {
  const v = await member();
  if (!v) return NOT_MEMBER;
  if (!(await own(v, id))) return NO_LIST;
  const { count } = await v.supabase.from("watchlists").select("id", { count: "exact", head: true }).eq("user_id", v.user.id);
  if ((count ?? 0) <= 1) return { error: "Keep at least one list. Rename this one instead." };
  const { error } = await v.supabase.from("watchlists").delete().eq("id", id).eq("user_id", v.user.id);
  if (error) return { error: "Couldn't delete the list. Try again." };
  refresh();
  return { ok: true };
}

/**
 * Adds a ticker to a list, registering it in public.symbols first when it's new (checked against Finnhub when there's a
 * key, as /api/symbols/add does).
 */
export async function addSymbol(id: string, raw: string): Promise<Done> {
  const v = await member();
  if (!v) return NOT_MEMBER;
  const ticker = tickerOf(raw);
  if (!TICKER.test(ticker)) return { error: "Type a ticker like NVDA, or pick a company from the list." };
  if (!(await own(v, id))) return NO_LIST;
  const { count } = await v.supabase.from("watchlist_items").select("ticker", { count: "exact", head: true }).eq("watchlist_id", id);
  if ((count ?? 0) >= LIST_SIZE) return { error: `This list is full (${LIST_SIZE} symbols). Start another list.` };
  const missing = await ensureSymbol(ticker);
  if (missing) return { error: missing };
  const { error } = await v.supabase.from("watchlist_items").insert({ watchlist_id: id, ticker });
  if (error?.code === "23505") return { error: `${ticker} is already on this list.` };
  if (error) return { error: `Couldn't add ${ticker}. Try again.` };
  refresh();
  return { ok: true };
}

export async function removeSymbol(id: string, raw: string): Promise<Done> {
  const v = await member();
  if (!v) return NOT_MEMBER;
  const ticker = tickerOf(raw);
  if (!TICKER.test(ticker) || !(await own(v, id))) return NO_LIST;
  const { error } = await v.supabase.from("watchlist_items").delete().eq("watchlist_id", id).eq("ticker", ticker);
  if (error) return { error: `Couldn't remove ${ticker}. Try again.` };
  refresh();
  return { ok: true };
}

/** Fills a list with SPY, QQQ, NVDA, AAPL and TSLA (any already on it stay as they are). */
export async function addStarters(id: string): Promise<Done> {
  const v = await member();
  if (!v) return NOT_MEMBER;
  if (!(await own(v, id))) return NO_LIST;
  const { error } = await v.supabase
    .from("watchlist_items")
    .upsert(
      STARTERS.map((ticker) => ({ watchlist_id: id, ticker })),
      { onConflict: "watchlist_id,ticker", ignoreDuplicates: true }
    );
  if (error) return { error: "Couldn't add them. Try again." };
  refresh();
  return { ok: true };
}
