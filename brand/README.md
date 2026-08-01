# Brand

The Feedex mark, "The Conversation Loop", and the tokens derived from it.

The SVGs here are the source of truth for the geometry. The React
implementation in [`src/components/brand/logo.tsx`](../src/components/brand/logo.tsx)
transcribes the same path data — if one changes, both must.

---

## The mark

A stadium oval split down the centre into two fused speech bubbles, with a chat
tail at each bottom corner and two rounded arrows circulating inside. The top
arrow travels out, the bottom one returns: the continuous loop between a person
reporting something and a developer fixing it.

- **Left half, gold `#F7B83D`** — the customer's voice
- **Right half, violet `#B58BF9`** — the developer's response
- **Arrows are knocked out** through an SVG mask, so whatever sits behind the
  mark shows through

### Variants

| File                      | Use                                                                            |
| ------------------------- | ------------------------------------------------------------------------------ |
| `feedex-mark.svg`         | Primary. Gold/violet duotone. Works on any background.                         |
| `feedex-mark-onlight.svg` | Plum + violet, for paper surfaces where gold washes out.                       |
| `feedex-mark-mono.svg`    | Single colour via `currentColor`. One-colour print, embosses, disabled states. |
| `feedex-app-icon.svg`     | 512×512 app icon; mark on a plum squircle at 22% radius.                       |
| `feedex-lockup-dark.svg`  | Horizontal lockup for dark backgrounds.                                        |

All share `viewBox="0 0 200 132"` — aspect ratio **1.515:1**. Scale with
`width`/`height` or CSS. Never distort.

### Geometry

- Oval: two half-stadium paths meeting at x=100, spanning x 10→190, y 12→98,
  cap radius 43
- Left tail `62,90 36,120 84,99` · right tail `138,90 164,120 116,99`
- Arrows: stroke-width 12, round caps and joins
  - Top → `M46 40 H152` + head `M130 27 L152 40 L130 53`
  - Bottom ← `M154 70 H48` + head `M70 57 L48 70 L70 83`

---

## Lockup

Horizontal only. Mark left, wordmark right.

- Wordmark: **Space Grotesk 600**, tracking `-0.03em`, sentence case — "Feedex",
  never "FEEDEX" or "feedex"
- Wordmark size = **0.82 × mark height**
- Gap = **0.25 × mark width** (= 0.379 × mark height)
- Vertically centre against the wordmark's _optical_ centre, not its bounding box
- Wordmark colour: `#F6F2F8` on dark, `#17101F` on light. Never gold or violet.

`<Logo>` derives all of this from one `font-size`, so scaling it responsively is
a class change:

```tsx
<Logo className="text-[26px] sm:text-[30px]" />
```

### Clear space and minimum sizes

- Clear space on all sides: **0.5 × mark height**
- Mark alone: **24px** tall minimum (below that, use the app icon)
- Lockup: **20px** mark height / ~120px total width
- App icon: 16px and up

---

## Colour

| Token                   | Hex                      | OKLCH                     | Role                           |
| ----------------------- | ------------------------ | ------------------------- | ------------------------------ |
| `--fx-gold`             | `#F7B83D`                | `oklch(0.82 0.15 80)`     | The customer's voice           |
| `--fx-violet`           | `#B58BF9`                | `oklch(0.72 0.16 300)`    | The developer's response       |
| `--fx-plum`             | `#17101F`                | `oklch(0.19 0.031 305)`   | Primary ground, arrow knockout |
| `--fx-plum-elevated`    | `#1E1529`                | —                         | Cards and panels on plum       |
| `--fx-paper`            | `#F4F1EA`                | `oklch(0.959 0.010 87.5)` | Light surface                  |
| `--fx-text-on-dark`     | `#F6F2F8`                | —                         | Text on plum                   |
| `--fx-text-muted-dark`  | `#8B7F99`                | —                         | Secondary text on plum         |
| `--fx-text-on-light`    | `#17101F`                | —                         | Text on paper                  |
| `--fx-text-muted-light` | `#8D8778`                | —                         | Secondary text on paper        |
| `--fx-border-dark`      | `rgba(255,255,255,0.10)` | —                         | Hairlines on plum              |
| `--fx-border-light`     | `#E3DED2`                | —                         | Hairlines on paper             |

**Gold and violet are brand accents, not UI status colours.** Gold is not a
warning; violet is not a link. The application's semantic ramps live in
[`src/styles/globals.css`](../src/styles/globals.css) and sit at hues far enough
from both — warning at 45° rather than gold's 80°, info at 235° rather than
violet's 300° — that a status can never be mistaken for branding.

Note that the neutral ramp is two families, not one: cool plum on dark, warm
paper on light.

---

## Typography

- **Display and UI:** Space Grotesk (400, 500, 600, 700). Tracking `-0.03em` on
  headings ≥28px.
- **Mono and labels:** Space Mono (400, 700), uppercase, tracking `0.28em`,
  11–12px. Available as the `.label-mono` utility.

Both are self-hosted by `next/font`, so there is no render-blocking request and
no layout shift.

---

## Radius

`6px` small · `10px` cards · `999px` pills · `22%` app icon squircle.

Mapped onto Tailwind's scale so existing utility usage lands on the right
values: `rounded-md` = 6px, `rounded-xl` = 10px, `rounded-full` = pill.

---

## Implementation notes

- **Inline the SVG** rather than using `<img>` when you need `currentColor` or
  CSS transitions on the halves.
- **Mask ids must be unique per document.** `<LogoMark>` generates one with
  `useId`, so several marks on a page cannot collide.
- **Accessibility:** the mark carries `role="img"` and `aria-label="Feedex"`.
  When it sits next to a visible "Feedex" wordmark, pass `labelled={false}` so
  the name is not announced twice.
- **Animation:** only the arrows may animate, along their own paths via
  `stroke-dashoffset` (`<LogoMark animated />`). The mark itself never rotates
  or bounces, and the animation is `motion-safe:` gated.

## Don'ts

- Don't repaint the knocked-out arrows as solid shapes.
- Don't swap the gold and violet sides — gold is always the left half.
- Don't add gradients, glows, drop shadows, or outlines to the mark.
- Don't stretch, skew, rotate, or reflow the tails.
- Don't place the mark on a mid-tone background where both halves lose contrast;
  use the `onlight` or `mono` variant.
- Don't recreate the wordmark in another typeface.
