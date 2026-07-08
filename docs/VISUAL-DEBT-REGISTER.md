# Visual Debt Register

Persistent, cross-phase record of known visual/UI issues that are real but
deliberately not being fixed in the phase that found them. Same purpose as
`docs/TECH-DEBT-REGISTER.md`, scoped to visual design rather than coaching
engine logic — read this before a visual phase to avoid rediscovering the
same item, and only action something here when a phase's own scope
naturally covers it.

**Do not action any item here unless it is explicitly and separately scoped.**

---

### 1. Readiness prompt title uses the destructive-confirm color
- **Where:** `index.html`, `.confirm__title { color: var(--danger) }` (~line 713), reused by `#readinessPromptTitle` ("How are you feeling today?").
- **Discovered:** Visual System Phase A (2026-07), during live verification — the readiness prompt's heading render as red/orange, which turned out to be `--danger`, not `--accent` as the original Phase A audit had assumed. Confirmed directly from the CSS, not guessed.
- **Risk:** Low-medium (visual only, no functional impact). A neutral coaching check-in ("How are you feeling today?") reads like a warning/error state because it inherits the same class the destructive "Are you sure?" confirm dialog uses.
- **Architecture impact:** None — purely a shared-class styling collision from Product Polish Phase 1 reusing `.confirm__title` for a non-destructive dialog.
- **Coaching impact:** None — this is presentation only, no effect on the readiness decision, degradation logic, or recovery swap.
- **Why deferred:** Visual Phase A was explicitly tokens-only (two global tokens, zero component CSS). Fixing this needs a new class or a scoped override, which belongs to the readiness/recovery visual polish phase, not a token-only phase.
- **Suggested handling:** During the readiness/recovery visual polish phase (Phase E), give `#readinessPromptTitle` its own class (or a modifier) styled with `--ink`, leaving `.confirm__title`'s `--danger` color intact for genuine destructive-confirm dialogs (Erase all data, Restore backup, etc.), which still want it.
