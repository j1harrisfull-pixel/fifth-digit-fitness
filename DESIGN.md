---
name: Fifth Digit Fitness
description: Offline personal training log — the instrument you glance at mid-set, not a lifestyle app
colors:
  bg: "#14110D"
  surface: "#1C1915"
  surface-2: "#262119"
  ink: "#F6F1EA"
  ink-dim: "#9C9287"
  muted: "#9C9287"
  faint: "#565B62"
  line: "#29241E"
  line-strong: "#473F35"
  accent: "#FF4A1C"
  accent-tint: "rgba(255,74,28,.14)"
  ready-green: "#26C281"
  ready-tint: "rgba(38,194,129,.14)"
  manage-amber: "#E8A23D"
  rough-red: "#FF6B52"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
    textTransform: "uppercase"
  mono:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontVariantNumeric: "tabular-nums"
rounded:
  none: "0px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    padding: "15px 32px 15px 15px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.none}"
  card-border:
    backgroundColor: "{colors.surface}"
  tag-outline:
    textColor: "{colors.ink-dim}"
---

# Design System: Fifth Digit Fitness

## 1. Overview

**Creative North Star: "The Instrument Panel"**

This is not a lifestyle app, it's a tool used mid-set, one-handed, under time pressure, in a gym.
Every screen is designed to be glanced at and understood in under a second, then put back down. The
aesthetic is dark, angular, numeric: tabular-nums everywhere a number appears, zero corner radius,
no shadows, no gradients. It reads like cockpit instrumentation, not a consumer wellness product.

This system explicitly rejects the generic fitness-influencer look: no gradient hero cards, no
badge/streak-shaming, no rounded-friendly SaaS softness, no hype copy ("CRUSH IT", "You're on
fire!"), no decorative motivational photography. Nothing here is trying to sell excitement. It's
trying to be correct and fast to read.

**Key Characteristics:**
- Dark canvas by default, zero corner radius, no shadows or blurs
- Exactly one accent color per screen, spent on the single next action
- All numeric data set in tabular-nums monospace so values don't jitter as they change
- Status is quiet (stroke-check, hairline circle); only the one active thing is loud
- A single 45°-clipped corner is the one signature shape, echoing the logo stencil cut

## 2. Colors

The palette is a tinted-neutral dark scale with a single hot-orange accent; nothing else in the
system is ever colored except the three semantic status hues (ready-green, manage-amber, rough-red).

### Primary
- **Signal Orange** (`#FF4A1C`): the single accent per screen. Used on exactly one action —
  START / LOG / Build / the current day's "NEXT" marker. Never used decoratively or on more than
  one element at a time.

### Neutral
- **Void Black** (`#14110D`): page background.
- **Panel** (`#1C1915`): card and container surfaces one step up from the void.
- **Panel Raised** (`#262119`): a second surface step for nested/hover states.
- **Signal White** (`#F6F1EA`): primary text (ink).
- **Dim Ink** (`#9C9287`): secondary text, captions, muted labels.
- **Faint Ink** (`#565B62`): tertiary text, disabled/placeholder states.
- **Hairline** (`#29241E`): default border/divider.
- **Hairline Strong** (`#473F35`): emphasized border (current-state cards, steppers).

### Status (semantic, not decorative)
- **Ready Green** (`#26C281`): recovery-ring fill, "done" tags, positive progression.
- **Manage Amber** (`#E8A23D`): eased/caution states (so-so readiness, amber fatigue).
- **Rough Red** (`#FF6B52`): recovery/danger states (rough readiness, red fatigue, delete actions).

### Named Rules
**The One Accent Rule.** Signal Orange appears on exactly one element per screen: the single most
important next action. Status, progress, and everything else uses neutral or the semantic status
hues — never orange for decoration.

## 3. Typography

**Display Font:** Geist (with ui-sans-serif, system-ui fallback)
**Body Font:** Geist (same family, lighter weight, for body copy)
**Label/Mono Font:** Spline Sans Mono, for every numeric value in the app

**Character:** A single geometric sans across display and body avoids visual noise; the mono face is
reserved strictly for numbers so weights, reps, and timers read as instrument data, distinct from
prose.

### Hierarchy
- **Display** (800, 22px, 1.06 line-height, -0.01em tracking): session/day names, the home hero title.
- **Title** (700, 17px, 1.1 line-height, -0.01em tracking): section headers, exercise card names.
- **Body** (400, 15px, 1.4 line-height): descriptive copy, why-lines, form notes.
- **Label** (700, 11px, 0.12em tracking, uppercase): overlines and field labels ("WORKING SETS",
  "SET YOUR WEIGHT").
- **Mono/tabular** (Spline Sans Mono, tabular-nums): every weight, rep count, RPE, timer, and 1RM
  value in the app, so digits never shift width as they change.

### Named Rules
**The Tabular Rule.** Any number the user reads at a glance during a set — weight, reps, RPE,
rest countdown, est. 1RM — renders in `font-variant-numeric: tabular-nums` Spline Sans Mono. Prose
never gets this treatment; only live, changing data does.

## 4. Elevation

Flat by default. No `box-shadow` in the dark theme (`--shadow: none`); depth is conveyed entirely
through the surface ladder (`bg` → `surface` → `surface-2`) and 1px hairline borders, never through
blur or drop shadow. The light theme (rarely used) carries a single soft ambient shadow
(`0 1px 2px rgba(17,18,22,.04), 0 10px 26px -14px rgba(17,18,22,.16)`), but dark is canonical.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest in the dark theme. Depth comes from tonal
steps and hairlines, never shadows. If a card looks like it needs a shadow to separate from the
background, give it a `line-strong` border instead.

## 5. Components

### Buttons
- **Shape:** zero radius on every button. The single primary action per screen additionally carries
  a 45°-clipped top-right corner: `clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)`.
- **Primary:** `background: accent`, `color: on-accent` (near-black text on the orange), padding
  `15px 32px 15px 15px` (extra right padding clears the clipped corner).
- **Secondary/icon:** `background: surface-2`, `border: 1px solid line`, no fill, hover shifts
  border to `line-strong`.
- **Hover/Focus:** icon buttons brighten border only, no background wash. Focus ring is a 2.5px
  solid `accent-ink` outline, offset 2px, never a glow.

### Tags / Chips
- **Style:** neutral outline by default — `1px solid line-strong`, `color: ink-dim`, no fill,
  uppercase, `letter-spacing: .1em`, mono-adjacent sizing (10-11px).
- **State:** the "next"/"alt" tags recolor border+text to `accent-ink`; "done" recolors to
  `ready-green`; "skipped" uses a dashed border in `faint`. Fill (tint background) is reserved for
  the current/active row only, never a default chip state.

### Cards / Containers
- **Corner Style:** zero radius, always.
- **Background:** `surface` for the base card, `surface-2` for a raised/nested surface (e.g. a
  promoted why-block or a hover row).
- **Shadow Strategy:** none (see Elevation). Separation is the `surface`/`surface-2` step plus a
  `line` or `line-strong` border.
- **Border:** 1px `line` by default; `line-strong` for a card in a current/emphasized state.
- **Internal Padding:** 14-20px depending on card density; compact list rows use 16px vertical /
  6px horizontal.

### Inputs / Steppers
- **Style:** numeric fields are boxed (`surface-2` background, `line-strong` border) so they read
  as tappable, per the affordance rule: editable = box/button, reference-only = flat text.
- **Focus:** border shifts to `accent-ink`; no glow, no shadow.
- **Unset/invitation state:** an unset starting weight gets a dashed `accent-ink` underline and
  accent-colored label text ("Set your weight") instead of sitting silently at 0.

### Navigation
- Icon-button row (program / history / settings), zero radius, `surface-2` background, single
  active/accent icon at a time (never more than one icon-btn `is-accent` simultaneously).

### The Why-Block (signature component)
The plain-language rationale behind a prescribed number. Two registers, by screen:
- **Home (demoted):** a single quiet line, `ink-dim`, 13px, no border — sits below the session name.
- **Active (first-class):** promoted to its own bordered block beside the current exercise only
  (`surface-2` background, `1px solid line-strong` full border, 8-10px padding). **Never a
  left/right side-stripe accent** — always a full border on all four sides.

## 6. Do's and Don'ts

### Do:
- **Do** use zero corner radius on every surface, card, button, and input, without exception.
- **Do** reserve Signal Orange (`#FF4A1C`) for exactly one action per screen.
- **Do** render every live number (weight, reps, RPE, timer, 1RM) in tabular-nums Spline Sans Mono.
- **Do** give the primary action button the 45°-clipped top-right corner; it is the one signature
  shape in the whole system.
- **Do** state a plain-language reason for every prescribed number, and promote that reason to a
  full-bordered block when it concerns the exercise the user is doing right now.
- **Do** say plainly when a session went backwards. Never dress up a regression.

### Don't:
- **Don't** use gradients, glassmorphism, or drop shadows anywhere in the dark (canonical) theme.
- **Don't** use a `border-left`/`border-right` colored stripe as an accent on any card, row, or
  callout — promote with a full border instead, never a side-stripe.
- **Don't** use badge/streak-shaming, gamified motivational copy, or fitness-influencer hype
  language ("CRUSH IT", "You're on fire!").
- **Don't** use more than one accent-colored element on a single screen at once.
- **Don't** fake praise or soften a regression to spare feelings — that violates the core honesty
  principle in PRODUCT.md.
- **Don't** round any corner, anywhere, for any reason — the zero-radius rule has no exceptions.
