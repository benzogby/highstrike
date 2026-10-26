# HighStrike design system

The look of highstrike.com since 2026-10-26: **quiet luxury with fintech precision**. Think of a private bank's
website crossed with a well-made trading screen. The references are luxury brands (Rolex, Aesop, Four Seasons: big
imagery, few words, a lot of space) and premium fintech (Mercury, Ramp, Stripe: precise, modern, product-forward).
Ben picked white, black and gold, serif headlines and a light page.

It lives in `src/app/globals.css` (the `lx-` tokens in `@theme` and the `[data-landing]` block) and
`src/app/(landing)/`. The homepage uses it today. Roll it out page by page.

## Principles

1. **Imagery and type carry the page.** Full-bleed film or photography, large serif headlines, generous space. If a
   section needs a decoration to look finished, the section is wrong.
2. **Data is set like typography.** Numbers are big serif figures or tabular sans figures with hairlines between them,
   not gauges, rings or glowing charts.
3. **One accent, used rarely.** Gold marks a label, a rule or a list mark. Green and red appear only on gains and losses.
4. **Say less.** One idea per section, one primary action per screen.
5. **Stillness reads as confidence.** The hero copy settles in once, the background film plays, and the chart line
   draws once. Nothing else moves.

## What makes a page look AI-made (never)

- Gradient washes, glows, neon accents, glassy blurred cards, drop shadows in color.
- Clusters of pill badges, emoji, sparkle icons, "✨ New" chips.
- Numbers that count up, bouncing or floating elements, notifications that drop in.
- A centered hero with a badge above the headline and a gradient word inside it.
- Three identical cards with an icon on top, repeated section after section.
- More than one accent color, or the accent on body text.
- Lorem ipsum, invented stats, fake testimonials on production.

## Color

| Token | Value | Use |
|---|---|---|
| `lx-paper` | `#ffffff` | Page ground |
| `lx-ivory` | `#f7f5f0` | Alternate sections, the hero ground until the film plays |
| `lx-stone` | `#efece6` | Quiet fills (rare) |
| `lx-ink` | `#0b0b0c` | Headlines, body, primary buttons |
| `lx-ink-2` | `#45454a` | Secondary text |
| `lx-ink-3` | `#6e6e73` | Captions, labels (5.0:1 on white) |
| `lx-line` | `#e7e4dd` | Hairlines, card borders |
| `lx-gold` | `#a8874a` | Rules, list marks, underlines (not for small text) |
| `lx-gold-ink` | `#7a5f32` | Gold text: eyebrows, small labels (6.0:1 on white, 5.4:1 on ivory) |
| `lx-up` | `#1e7a4c` | Gains only |
| `lx-down` | `#b42318` | Losses only |

Gains and losses always carry a sign (+ or −) as well as the color, so they never rely on hue alone.

## Type

- **Display:** Cormorant Garamond 500 (italic for one emphasized phrase at most), `font-lx-serif`.
  Hero `clamp(46px, 9vw, 104px)` / 0.98, section titles `clamp(36px, 5.2vw, 64px)` / 1.02, card titles 22–28px.
  Tracking −0.01em to −0.015em on large sizes.
- **Text and UI:** Hanken Grotesk 400/500/600, `font-lx-sans`. Body 17px / 1.65, small 15px, captions 13px.
- **Eyebrow:** Hanken Grotesk 600, 11.5px, uppercase, tracking 0.22em, `lx-gold-ink`. One per section, above the title.
- **Figures:** big statistics in the serif; prices and percentages in the sans with `tabular-nums`. No monospace on
  marketing pages.

Both families are loaded in `src/app/(landing)/layout.tsx` with next/font, so only pages that use the system
download them.

## Space and layout

- Content width 1240px with 20px gutters on phones and 32px from `sm`.
- Section padding 96px on phones and 128px from `lg`. Separate sections with a hairline or an ivory ground, never both.
- 12-column grid on desktop. Text sits in 5 columns and the product or table in 6–7.
- Phones first: every row stacks, tables drop their least important column, and touch targets are at least 44px.

## Components

- **Header:** white, a hairline below, sticky. The bull mark in black (`brightness-0` on the uploaded logo), the
  serif wordmark, three anchors from `md`, Sign in, and the primary button.
- **Buttons:** primary is ink with white text, 4px radius, min-height 48px, 15px/500. The secondary action is a text
  link with a gold underline that turns ink on hover. No pill shapes, shadows or arrows in circles.
- **Hero:** full-bleed. A muted, looping background film (`HeroVideo`) with a left-side white scrim for legibility, a
  pause button, and the poster for reduced-motion visitors. The copy sits bottom-left: eyebrow, serif headline,
  one paragraph, the primary button and a text link, then a 13px line on price.
- **Proof row:** four figures in the serif with small-caps labels, divided by hairlines.
- **Product frame ("The Briefing"):** a white card with a hairline border, 10px radius and one soft neutral shadow,
  showing the real report, metrics with 2px bars, today's setups with locked entries, and a single ink line chart.
- **Record table:** an ink rule over the header row, hairlines between rows, and tabular, signed, colored results.
- **Membership card:** the serif price, a hairline list with gold dashes, a full-width primary button and the trial
  terms in 13px.
- **FAQ:** native `details` rows with serif questions, a gold plus that turns into a cross, and an ink rule on top.

## Imagery and film

Bright, daylight luxury interiors that match the light page, such as a penthouse office in morning light with marble,
linen, brass and a city view. People are seen working, from behind or at a distance, never posing. Screens stay soft or
out of focus, so no fake charts or text are legible. Slow camera moves (dolly or push-in), no cuts faster than about
4 seconds, a 12–20 second seamless loop, 1080p or larger, and under about 8 MB for the web cut (H.264 MP4, with a WebM
alongside if useful).
