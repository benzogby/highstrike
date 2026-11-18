import "server-only";
import { supabaseAdmin } from "@/features/inbox/platform";
import { decrypt, encrypt } from "@/features/inbox/platform";
import { UserError } from "@/features/inbox/errors";
import { site } from "@/features/inbox/platform";
import { MAILBOX_DOMAIN } from "@/lib/inbox-mail";
import type { InboxState, NotReady } from "./types";

/**
 * Admin → Inbox's way into Gmail (Ben, 2026-10-28, picking "Private Google app"): a Google app with the audience
 * "Internal", which Ben made in a Google Cloud project under the highstrike.com Workspace. Internal means only
 * highstrike.com accounts can use it, so Gmail's full scope needs no review by Google, and its refresh tokens don't run
 * out after a week as a test app's do. He pastes its client id and secret on the Inbox page once, then Connect asks Google
 * for ben@highstrike.com's permission; the refresh token that comes back is kept encrypted (lib/crypto, the key Instagram's
 * tokens use) in public.inbox_gmail, which only the service role reads. The access tokens it buys live in this server's
 * memory for their hour and never leave it. No key, code or token is ever logged; why a Connect was refused is, in words
 * (Admin → Errors and the setup card).
 */

/** Full Gmail: read, send, labels, and "Delete forever" in Trash and Spam (which gmail.modify can't do). */
export const INBOX_SCOPE = "https://mail.google.com/";
export const INBOX_STATE_COOKIE = "inbox_oauth";
export const redirectUri = () => `${site.url.replace(/\/$/, "")}/api/admin/inbox/callback`;

type Row = {
  client_id: string | null; client_secret_enc: string | null; refresh_token_enc: string | null;
  email: string | null; scope: string | null; connected_at: string | null; error: string | null;
};

/** Why Connect didn't finish, as a code the page words itself (app/api/admin/inbox/callback → ?connect=). */
export type ConnectCode = "denied" | "expired" | "scope" | "account" | "gmail" | "failed";
export class ConnectProblem extends Error {
  code: ConnectCode;
  constructor(code: ConnectCode, message: string) {
    super(message);
    this.name = "ConnectProblem";
    this.code = code;
  }
}

/** The mailbox can't be read: no app saved, never connected, or Google ended the connection. */
export class InboxNotReady extends Error {
  reason: NotReady;
  constructor(reason: NotReady) {
    super(reason === "no_client" ? "The Inbox's Google app isn't set up yet." : reason === "revoked" ? "Google ended the Gmail connection. Connect it again." : "Gmail isn't connected yet.");
    this.name = "InboxNotReady";
    this.reason = reason;
  }
}

let cachedRow: { row: Row | null; at: number } | null = null;
let token: { value: string; exp: number; key: string } | null = null;
let refreshing: Promise<string> | null = null;

/** The one row, kept for half a minute so a page's dozen Gmail calls read the database once. */
async function inboxRow(fresh = false): Promise<Row | null> {
  if (!fresh && cachedRow && Date.now() - cachedRow.at < 30_000) return cachedRow.row;
  const { data, error } = await supabaseAdmin().from("inbox_gmail")
    .select("client_id, client_secret_enc, refresh_token_enc, email, scope, connected_at, error").eq("id", "gmail").maybeSingle();
  if (error) throw new Error(`inbox settings: ${error.message}`);
  cachedRow = { row: (data as Row | null) ?? null, at: Date.now() };
  return cachedRow.row;
}

const forget = () => {
  cachedRow = null;
  token = null;
};

export async function inboxState(): Promise<InboxState> {
  const row = await inboxRow(true);
  return {
    configured: !!row?.client_id && !!row.client_secret_enc,
    connected: !!row?.refresh_token_enc,
    clientId: row?.client_id ?? null,
    email: row?.email ?? null,
    error: row?.error ?? null,
    redirectUri: redirectUri(),
  };
}

/**
 * The Google app's client id and secret, as Ben pastes them. A new client id drops the old connection (its refresh token
 * belongs to the old app); a new secret for the same app keeps it, as Google does.
 */
export async function saveClient(clientId: string, secret: string) {
  const id = clientId.trim();
  const sec = secret.trim();
  if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(id)) throw new UserError("That isn't a Google client ID. It ends in .apps.googleusercontent.com.");
  if (sec.length < 12 || sec.length > 200 || /\s/.test(sec)) throw new UserError("That client secret doesn't look right. Copy it again from Google (it starts GOCSPX-).");
  const row = await inboxRow(true);
  const same = row?.client_id === id;
  const { error } = await supabaseAdmin().from("inbox_gmail").upsert({
    id: "gmail", client_id: id, client_secret_enc: encrypt(sec), error: null, updated_at: new Date().toISOString(),
    ...(same ? {} : { refresh_token_enc: null, email: null, scope: null, connected_at: null }),
  });
  if (error) throw new Error(`inbox settings: ${error.message}`);
  forget();
}

/** Google's permission screen for the mailbox: ben@highstrike.com picked already, only highstrike.com accounts offered. */
export async function authUrl(state: string): Promise<string> {
  const row = await inboxRow(true);
  if (!row?.client_id || !row.client_secret_enc) throw new InboxNotReady("no_client");
  const q = new URLSearchParams({
    client_id: row.client_id, redirect_uri: redirectUri(), response_type: "code", scope: INBOX_SCOPE,
    access_type: "offline", prompt: "consent", hd: MAILBOX_DOMAIN, login_hint: row.email ?? `ben@${MAILBOX_DOMAIN}`, state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenAnswer = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };

async function tokenCall(body: Record<string, string>): Promise<TokenAnswer> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as TokenAnswer;
  return res.ok ? json : { ...json, error: json.error ?? `http_${res.status}` };
}

/** Google's words for a refused code, short: the error's name, and its description when that says more. */
function googleSaid(t: TokenAnswer) {
  const what = (t.error ?? "no token").replace(/[^\w.-]/g, "").slice(0, 60);
  const why = (t.error_description ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  return why && why.toLowerCase() !== what.toLowerCase() ? `${what}: ${why}` : what;
}

/**
 * Connect's last step (app/api/admin/inbox/callback): Google's code for tokens, the account checked to be highstrike.com's
 * own and to have allowed Gmail, and the refresh token kept. Returns the address, or throws a ConnectProblem saying why not.
 */
export async function connectWithCode(code: string): Promise<string> {
  const row = await inboxRow(true);
  if (!row?.client_id || !row.client_secret_enc) throw new InboxNotReady("no_client");
  const t = await tokenCall({ code, client_id: row.client_id, client_secret: decrypt(row.client_secret_enc), redirect_uri: redirectUri(), grant_type: "authorization_code" });
  if (t.error || !t.access_token) {
    const said = googleSaid(t);
    if (t.error === "invalid_grant") throw new ConnectProblem("expired", `Google said its sign-in code was used already or too old (${said}). Connect again.`);
    if (t.error === "invalid_client" || t.error === "unauthorized_client") {
      throw new ConnectProblem("failed", `Google didn't accept the saved client ID and secret (${said}). In Google → Clients → HighStrike Inbox, add a new secret, then press Change the app here, paste the client ID and the new secret, Save and connect.`);
    }
    throw new ConnectProblem("failed", `Google didn't finish the connection (${said}).`);
  }
  if (!(t.scope ?? "").split(/\s+/).includes(INBOX_SCOPE)) throw new ConnectProblem("scope", `Google allowed ${t.scope ? `"${t.scope.slice(0, 200)}"` : "nothing"}, not Gmail.`);
  if (!t.refresh_token) throw new ConnectProblem("failed", "Google didn't hand over a lasting key.");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { authorization: `Bearer ${t.access_token}` }, cache: "no-store" });
  const profile = (await res.json().catch(() => ({}))) as { emailAddress?: string; error?: { message?: string } };
  const email = (profile.emailAddress ?? "").toLowerCase();
  if (!res.ok || !email) {
    const said = (profile.error?.message ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    throw new ConnectProblem("gmail", `Gmail answered ${res.status}${said ? `: ${said}` : " without the account's address."}`);
  }
  if (!email.endsWith(`@${MAILBOX_DOMAIN}`)) {
    await revoke(t.refresh_token);
    throw new ConnectProblem("account", `That was ${email}, not a ${MAILBOX_DOMAIN} account.`);
  }
  const kept = encrypt(t.refresh_token);
  const { error } = await supabaseAdmin().from("inbox_gmail").update({
    refresh_token_enc: kept, email, scope: t.scope ?? INBOX_SCOPE, connected_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString(),
  }).eq("id", "gmail");
  if (error) throw new Error(`inbox settings: ${error.message}`);
  forget();
  token = { value: t.access_token, exp: Date.now() + (t.expires_in ?? 3600) * 1000, key: kept.slice(-32) };
  return email;
}

async function revoke(refreshToken: string) {
  await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }), cache: "no-store" }).catch(() => null);
}

/** Disconnect: Google is told to forget the key, and it's gone from here. The app's id and secret stay for a reconnect. */
export async function disconnect() {
  const row = await inboxRow(true);
  if (row?.refresh_token_enc) {
    try {
      await revoke(decrypt(row.refresh_token_enc));
    } catch { /* a key we can't read is as good as gone */ }
  }
  const { error } = await supabaseAdmin().from("inbox_gmail").update({ refresh_token_enc: null, scope: null, connected_at: null, error: null, updated_at: new Date().toISOString() }).eq("id", "gmail");
  if (error) throw new Error(`inbox settings: ${error.message}`);
  forget();
}

/** Google ended the connection: the key is dropped and why is kept, for the page's reconnect card. */
async function markRevoked(why: string) {
  await supabaseAdmin().from("inbox_gmail").update({ refresh_token_enc: null, connected_at: null, error: why, updated_at: new Date().toISOString() }).eq("id", "gmail");
  forget();
}

/**
 * Why the last Connect didn't finish (app/api/admin/inbox/callback), kept while the mailbox isn't connected so the setup
 * card still says it after a reload, in Google's own words where it gave any. Saving the app or connecting clears it.
 */
export async function noteConnectProblem(why: string) {
  await supabaseAdmin().from("inbox_gmail").update({ error: why.slice(0, 600), updated_at: new Date().toISOString() }).eq("id", "gmail").is("refresh_token_enc", null);
  forget();
}

/**
 * An access token for the mailbox: this instance's while it has more than a minute left, else a new one from the refresh
 * token (one refresh at a time, however many calls ask at once).
 */
export async function accessToken(): Promise<string> {
  const row = await inboxRow();
  if (!row?.client_id || !row.client_secret_enc) throw new InboxNotReady("no_client");
  // Revoked once it had been connected (markRevoked keeps the address); a first Connect that failed is still "not yet".
  if (!row.refresh_token_enc) throw new InboxNotReady(row.error && row.email ? "revoked" : "not_connected");
  const key = row.refresh_token_enc.slice(-32);
  if (token && token.key === key && token.exp > Date.now() + 60_000) return token.value;
  if (refreshing) return refreshing;
  const clientId = row.client_id;
  const secretEnc = row.client_secret_enc;
  const refreshEnc = row.refresh_token_enc;
  refreshing = (async () => {
    const t = await tokenCall({ client_id: clientId, client_secret: decrypt(secretEnc), refresh_token: decrypt(refreshEnc), grant_type: "refresh_token" });
    if (!t.access_token) {
      if (t.error === "invalid_grant") {
        await markRevoked("Google ended the connection (a password change, or the app removed from the account, does this). Connect again.");
        throw new InboxNotReady("revoked");
      }
      if (t.error === "invalid_client" || t.error === "unauthorized_client") {
        await markRevoked("Google refused the app's client ID or secret. Paste them again, then connect.");
        throw new InboxNotReady("revoked");
      }
      throw new Error(`Google's token refresh failed (${t.error ?? "no token"})`);
    }
    token = { value: t.access_token, exp: Date.now() + (t.expires_in ?? 3600) * 1000, key };
    return t.access_token;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** A token Gmail refused (401): the next call buys a new one. */
export function dropAccessToken() {
  token = null;
}
