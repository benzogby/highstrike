"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/membership";
import { asOption } from "@/lib/optionIdea";
import { nyToday } from "@/lib/trades";

// The journal's buttons (src/lib/trades.ts): take an idea, log a trade of your own, close one, write its notes, delete
// it. Each runs as the member, so the table's own rules (supabase/migrations/20261103190000_trades.sql) keep every trade
// private to its owner.

type Result = { ok: true; id?: string } | { ok: false; error: string };

const ID = /^[0-9a-f-]{36}$/i;
const TICKER = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/** A positive amount from what was typed ("$1,250.50" works), or null. */
function amount(x: unknown, max = 1e9) {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x.replace(/[$,\s]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 10_000) / 10_000 : null;
}

function refresh(setupId?: string | null) {
  revalidatePath("/journal");
  if (setupId) revalidatePath(`/ideas/${setupId}`);
}

/** "I took this" on an idea: its shares, or the option it suggested, at the price paid. The idea's target and stop come along to watch. */
export async function takeIdea(input: { setupId: string; instrument: "stock" | "option"; price: unknown; quantity: unknown }): Promise<Result> {
  const { supabase, user } = await requireMember("/journal");
  if (!ID.test(input.setupId)) return { ok: false, error: "That idea wasn't found." };
  const { data: idea } = await supabase
    .from("setups")
    .select("id, ticker, direction, entry_price, target_price, stop_price, option")
    .eq("id", input.setupId)
    .maybeSingle();
  if (!idea) return { ok: false, error: "That idea wasn't found." };
  const option = input.instrument === "option" ? asOption(idea.option) : null;
  if (input.instrument === "option" && !option) return { ok: false, error: "This idea has no suggested option." };
  const price = amount(input.price, 1e6);
  if (!price) return { ok: false, error: input.instrument === "option" ? "Enter what you paid per share for the option (e.g. 3.20)." : "Enter the price you paid per share." };
  const quantity = amount(input.quantity, 1e7);
  if (!quantity || (input.instrument === "option" && !Number.isInteger(quantity))) {
    return { ok: false, error: input.instrument === "option" ? "Enter how many contracts (a whole number)." : "Enter how many shares." };
  }
  const entry = idea.entry_price != null ? Number(idea.entry_price) : null;
  // The idea's own stop, else the standard 8% against its entry (src/lib/setupEngine.ts grading).
  const stop = idea.stop_price != null ? Number(idea.stop_price) : entry != null ? Math.round(entry * (idea.direction === "long" ? 0.92 : 1.08) * 100) / 100 : null;
  const { data, error } = await supabase
    .from("trades")
    .insert({
      user_id: user.id,
      setup_id: idea.id,
      ticker: idea.ticker,
      direction: idea.direction,
      instrument: input.instrument,
      option,
      entry_price: price,
      quantity,
      target: idea.target_price != null ? Number(idea.target_price) : null,
      stop,
      opened_on: nyToday(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "It didn't save. Try again." };
  refresh(idea.id);
  return { ok: true, id: data.id };
}

/** A trade of your own, not from an idea: shares, long or short, with the levels to watch if you want them. */
export async function logTrade(input: { ticker: unknown; direction: unknown; price: unknown; quantity: unknown; target?: unknown; stop?: unknown; notes?: unknown }): Promise<Result> {
  const { supabase, user } = await requireMember("/journal");
  const ticker = typeof input.ticker === "string" ? input.ticker.trim().toUpperCase().replace(/^\$/, "") : "";
  if (!TICKER.test(ticker)) return { ok: false, error: "Enter a ticker, like AAPL." };
  const direction = input.direction === "short" ? "short" : "long";
  const price = amount(input.price, 1e6);
  if (!price) return { ok: false, error: "Enter the price you paid per share." };
  const quantity = amount(input.quantity, 1e7);
  if (!quantity) return { ok: false, error: "Enter how many shares." };
  const target = input.target ? amount(input.target, 1e6) : null;
  const stop = input.stop ? amount(input.stop, 1e6) : null;
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 4000) : null;
  const { data, error } = await supabase
    .from("trades")
    .insert({ user_id: user.id, ticker, direction, instrument: "stock", entry_price: price, quantity, target, stop, notes, opened_on: nyToday() })
    .select("id")
    .single();
  if (error) return { ok: false, error: "It didn't save. Try again." };
  refresh();
  return { ok: true, id: data.id };
}

/** Closes a trade at the price it was sold (or bought back) for, per share. */
export async function closeTrade(id: string, exit: unknown): Promise<Result> {
  const { supabase } = await requireMember("/journal");
  if (!ID.test(id)) return { ok: false, error: "That trade wasn't found." };
  const price = typeof exit === "string" && exit.trim() === "0" ? 0 : amount(exit, 1e6);
  if (price == null) return { ok: false, error: "Enter the price per share you got out at (0 if it expired worthless)." };
  const { data, error } = await supabase
    .from("trades")
    .update({ status: "closed", exit_price: price, closed_on: nyToday(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("setup_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "It didn't save. Try again." };
  refresh(data.setup_id);
  return { ok: true };
}

/** Opens a closed trade again (closed by mistake). */
export async function reopenTrade(id: string): Promise<Result> {
  const { supabase } = await requireMember("/journal");
  if (!ID.test(id)) return { ok: false, error: "That trade wasn't found." };
  const { data, error } = await supabase
    .from("trades")
    .update({ status: "open", exit_price: null, closed_on: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("setup_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "It didn't save. Try again." };
  refresh(data.setup_id);
  return { ok: true };
}

/** The trade's journal notes (up to 4,000 characters). */
export async function saveNotes(id: string, notes: string): Promise<Result> {
  const { supabase } = await requireMember("/journal");
  if (!ID.test(id)) return { ok: false, error: "That trade wasn't found." };
  const text = notes.trim().slice(0, 4000) || null;
  const { error } = await supabase.from("trades").update({ notes: text, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "It didn't save. Try again." };
  refresh();
  return { ok: true };
}

export async function deleteTrade(id: string): Promise<Result> {
  const { supabase } = await requireMember("/journal");
  if (!ID.test(id)) return { ok: false, error: "That trade wasn't found." };
  const { data, error } = await supabase.from("trades").delete().eq("id", id).select("setup_id").maybeSingle();
  if (error) return { ok: false, error: "It didn't delete. Try again." };
  refresh(data?.setup_id);
  return { ok: true };
}
