import type { Appearance } from "@stripe/stripe-js";

// Stripe's card fields in the page's own colours. Stripe draws them in its own frames, which can't read CSS variables,
// so the values are read off the element around them: the app's tokens (globals.css, light or dark), or the homepage
// popup's dark green ones (landing.css → .hs-join).

function hex(value: string) {
  const v = value.trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : null;
}

function isDark(color: string) {
  const h = hex(color);
  if (!h) return true;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}

export function appearanceFrom(el: HTMLElement | null): Appearance {
  const css = el ? getComputedStyle(el) : null;
  const token = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback;
  const panel = token("--color-panel", "#111318");
  const accent = hex(token("--color-accent", "#009f6f")) ?? "#009f6f";
  const line = token("--color-line-strong", "rgba(255, 255, 255, 0.14)");
  const dark = isDark(panel);
  return {
    theme: dark ? "night" : "stripe",
    variables: {
      colorPrimary: accent,
      colorBackground: token("--color-panel-2", dark ? "#171a20" : "#ffffff"),
      colorText: token("--color-ink", dark ? "#f4f5f7" : "#14161a"),
      colorTextSecondary: token("--color-ink-2", dark ? "#a3abb8" : "#4a5160"),
      colorTextPlaceholder: token("--color-ink-3", "#6b7280"),
      colorDanger: token("--color-down", dark ? "#f87171" : "#dc2626"),
      borderRadius: "10px",
      fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSizeBase: "15px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": { border: `1px solid ${line}`, boxShadow: "none", padding: "11px 12px" },
      ".Input:focus": { border: `1px solid ${accent}`, boxShadow: `0 0 0 3px ${accent}33` },
      ".Label": { fontWeight: "500", marginBottom: "6px" },
      ".Tab": { border: `1px solid ${line}`, boxShadow: "none" },
      ".Tab--selected": { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` },
    },
  };
}

/** Inter for Stripe's frames, which can't use the page's own copy of it. */
export const STRIPE_FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" }];
