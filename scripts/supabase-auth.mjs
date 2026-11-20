#!/usr/bin/env node
// Supabase Auth settings for the project (the security review, 2026-11-20): `npm run supabase:auth` prints the
// settings that matter for security (never a secret); `npm run supabase:auth -- set key=value …` changes them through
// the Management API with the Keychain token scripts/supabase.mjs uses.

import { savedKey } from "./lib/mac.mjs";

const API = "https://api.supabase.com/v1";
const REF = "dobrcbahlbypzvbuwkoe";
const SHOW = [
  "disable_signup", "external_email_enabled", "external_google_enabled", "mailer_autoconfirm", "password_min_length",
  "password_required_characters", "password_hibp_enabled", "security_captcha_enabled", "rate_limit_email_sent",
  "rate_limit_token_refresh", "rate_limit_verify", "rate_limit_otp", "rate_limit_anonymous_users", "rate_limit_sms_sent",
  "mfa_totp_enroll_enabled", "mfa_totp_verify_enabled", "jwt_exp", "refresh_token_rotation_enabled",
  "security_refresh_token_reuse_interval", "sessions_timebox", "sessions_inactivity_timeout", "uri_allow_list", "site_url",
  "external_anonymous_users_enabled", "mailer_otp_exp", "security_update_password_require_reauthentication",
  "mailer_secure_email_change_enabled",
];

const token = await savedKey("SUPABASE_ACCESS_TOKEN");
if (!token) {
  console.error("No Supabase token in the Keychain. Run npm run supabase:token.");
  process.exit(1);
}
const call = async (init = {}) => {
  const res = await fetch(`${API}/projects/${REF}/config/auth`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body;
};

const [cmd, ...pairs] = process.argv.slice(2);
if (cmd === "set") {
  const patch = Object.fromEntries(
    pairs.map((p) => {
      const [k, ...v] = p.split("=");
      const raw = v.join("=");
      return [k, raw === "true" ? true : raw === "false" ? false : /^\d+$/.test(raw) ? Number(raw) : raw];
    })
  );
  if (!Object.keys(patch).every((k) => SHOW.includes(k))) throw new Error(`Only these can be set here: ${SHOW.join(", ")}`);
  await call({ method: "PATCH", body: JSON.stringify(patch) });
}
const now = await call();
for (const k of SHOW) console.log(`${k.padEnd(52)} ${JSON.stringify(now[k])}`);
