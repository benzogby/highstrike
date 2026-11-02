# HighStrike's brand pack

HighStrike's own art for its admin-only style (docs/DECISIONS.md → "HighStrike", "HighStrike's render"; docs/styles/highstrike.md). Reels in the HighStrike style draw it through `reel.brand` and `ctx.brand()` (src/lib/brand.ts), never through `ctx.logo()`. It never ships in the Ripping plugin (scripts/build-plugin.mjs).

## Source

- `logo.png`: the 2835 × 2835 px low-poly bull, downloaded on 2026-10-25 from HighStrike's own site storage (the logo highstrike.com shows, and the one the approved keyframes' hs.css loads):
  https://dobrcbahlbypzvbuwkoe.supabase.co/storage/v1/object/public/site-assets/logo/1787159132488--highstrike.png
- sha256 `4f2223396235d03a6510a6a95ce8314ffa6e4c3a73243704b1047b0395969ed2` (brand.json → source).

## Baked from it

`npx tsx scripts/highstrike-brand.ts` bakes these from `logo.png` and writes `brand.json`. Spends nothing.

| File | What it is |
|---|---|
| `mark.png` | The flat bull: the logo's silhouette in white on its square canvas, 1024 px, for a scene to tint through a mask (hs.css `.bull`). |
| `watermark.png` | The low-poly bull in grey, brightened 1.5× (hs.css `.bullmark`), 1760 px: the green ground's faint mark, before its 9% screen (src/render/grounds.ts). |
| `lockup.png` | The lockup for a dark ground (the green, and the black grid: DECISIONS → "HighStrike's grounds: three pairs"): the bull in #1FBF86 and HIGHSTRIKE in white Oswald 500, at 3× the keyframes' 66 px (198 px tall). |
| `lockup-alt.png` | The lockup for a light ground (the mint, and the white grid): the bull in #02A06F and the word in #0D1512. |
| `wordmark.png` | HIGHSTRIKE alone in white Oswald 600, as k5's end card stacks it under its big bull (104 px, 1 px tracking), its line box at 3× (312 px tall): for a dark ground. |
| `wordmark-alt.png` | The same in #0D1512, for a light ground. |

The brand layer and `ctx.brand()` pick each by the ground's tone, not its place in the reel, so a reel whose base is the white grid draws the `-alt` pictures on its base and the others on its black alt.

The wordmark is baked into the lockups and the wordmarks: Oswald is a dev dependency used only by the bake, never at render time.
