# Programming Philosophy — the Coaching Logic Spec

**Status:** Approved design (2026-07-07). This is the *why* and *what* of the
coaching engine. Implementation happens phase-by-phase, test-first, from a
separate build plan.

---

## 0. The Goal (North Star — hold this while building)

Every generated session must read as though **a great coach wrote it**.

Five things are non-negotiable.

**1. Reasoned**
- Every exercise has a clear purpose.
- Nothing is filler.
- Nothing is chosen because it is merely "valid."

**2. Right Hard**
- Effort, volume and intensity are matched precisely to the athlete's goal,
  readiness and experience.
- No junk volume.
- No sandbagging.

**3. Balanced & Injury Smart**
- Training remains balanced over time.
- Antagonists and weak points are addressed.
- Known injuries and no-go movements are respected.
- Exercises are sequenced intelligently so the athlete finishes worked, not
  wrecked.

**4. Goes Somewhere**
- Training follows a deliberate progression.
- Loads increase when earned.
- Fatigue is managed.
- Every session contributes to a longer-term plan.

**5. Session Coherence**
- The workout should feel like one complete coaching decision, not a collection
  of individually good exercises.
- Every exercise should reinforce the session theme and support the overall
  training objective.
- A great session has a clear identity.

### Contradiction Rule

If any implementation decision would violate one of these principles, stop and
raise it before shipping.

"Valid and varied" is not the standard. **Purposeful is.**

---

## 1. Locked Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Progression arc | **Hybrid** — one anchor lift per movement pattern progresses from logged history. Supporting work stays fresh. |
| 2 | Design engine | **Rich offline rules.** No LLM in the hot path. 100% offline, instant and private. |
| 3 | Coach assertiveness | **Coach the request against the training week.** Honour the requested theme while shaping specifics from readiness, weekly debt and recent training. Never silently override intent. |
| 4 | Variation doctrine | **Curated variety.** Stable anchor plus rotating best-in-class accessories selected for a reason. |
| 5 | Athlete model | **Light profile captured once.** Learn preferences over time from behaviour. |
| 6 | Elite rubric | **All five dimensions above are always satisfied.** |

---

## 2. Build on What Already Exists

Reuse and extend the existing architecture.

**Keep:**
- Section-C exercise library tags (`movement_pattern`, `primary_muscles`, …)
- `selectComplementary()` / `pickStrength()`
- weekly debt
- fatigue and readiness (`computeFatigueState()`, degradation logic,
  "build it anyway")
- `buildSetPlan()` / prescription engine
- time-budgeted blocks
- mandatory warm-up + mandatory cool-down
- per-exercise "why" strings
- Node test suite

**New work:**
- Intent object
- Frozen anchor progression
- Curated exercise pools
- Intent ranker
- Stimulus prescription
- Athlete profile
- Rubric validation

---

## 3. Components

### 3.1 Session Blueprint

Every request first resolves into an explicit **intent object** before any
exercise is chosen.

```
Primary:
    target
    stimulus  → strength | tension | pump | power | conditioning
Secondary targets
Constraints:
    minutes
    equipment
    readiness
    injuries
    experience
```

Intent is mapped into **purpose slots**:

`Preparation → Power/Skill (optional) → Anchor → Secondary Compound →
Accessory (balance or weak point) → Isolation → Finisher (optional) → Cooldown`

- The **request** determines the session theme.
- **Weekly debt** determines secondary emphasis.
- **Readiness** adjusts volume only.
- Intent is never silently overridden. The existing
  readiness → recovery → "build it anyway" flow remains the only override path.

### 3.2 Anchor & Arc

Exactly one anchor exists for each movement pattern.

**Movement patterns are fixed and should not change:**
- Squat
- Hinge
- Horizontal Push
- Vertical Push
- Horizontal Pull
- Vertical Pull

(Core and carries remain optional future patterns.)

Once selected for an athlete, the anchor is **frozen** for that movement
pattern.

**Progression uses double progression:**
- Reach the top of the rep range across all prescribed sets → increase load.
- Otherwise continue earning reps.

**Auto-deload** occurs:
- when fatigue for that movement pattern reaches **Red**, or
- every Nth exposure.

Deload approximately: **−40% volume, +1 RIR.**

Only the anchor carries the long-term progression arc.

### 3.3 Selection with Intent

Every non-anchor exercise follows:

`Role → Curated Pool → Ranking → Selection`

Pools are hand-curated and tiered: **Core · Quality · Fringe.**
Only **Core** and **Quality** exercises are eligible during normal programming.

**Hard filters** remove:
- unavailable equipment
- injuries
- no-go movements
- insufficient skill level

**Ranking** considers:
- fit to intent
- weekly debt
- recency penalty
- learned preference

The previous session's variation is **never repeated.**

Every exercise carries a meaningful reason. Examples:
- "Rear delts lagging this week."
- "Balances today's pressing."
- "Lower fatigue option while maintaining hinge volume."

### 3.4 Prescription Matched to Stimulus

| Stimulus | Reps | Rest | Intermediate RIR |
|---|---|---|---|
| Strength | 3–5 | 3–5 min | 1–2 |
| Tension (compound) | 6–12 | 2–3 min | 1–3 |
| Tension (isolation) | 10–15 | 60–120 sec | 1–2 |
| Pump | 15–20 | 30–60 sec | 0–2 |
| Power | 2–5 | Full recovery | Leave speed |

Beginners receive: lower volume, +1 RIR, simpler movement selection.

**Weekly volume targets (sets per muscle):** MEV ≈ 8–10 · MAV ≈ 12–18 ·
MRV ≈ 20–22.

Session volume scales to the available time budget. Rolling weekly totals never
exceed MRV.

Compound lifts should contribute intelligently to **multiple** muscle groups
rather than counting only toward a single primary muscle.

### 3.5 Balance & Safety

Injuries are separated into four categories:
1. Painful movements
2. Restricted joints or regions
3. Medical red flags
4. User preferences / permanent no-go movements

Only **preferences** may be overridden by later user choice. Painful or
medically restricted movements are **never** prescribed.

**Antagonist balance** is tracked continuously (e.g. Push vs Pull, Quad vs
Hinge).

**Weak points** earn additional accessory work when time allows.

**Hard conditioning** is separated appropriately from heavy lower-body work.

### 3.6 Athlete Model

```
athlete
    experience
    injuries
    preferences
```

Experience and injuries are captured once. Preferences are learned
automatically:
- Skipped repeatedly → preference decreases
- Completed consistently → preference increases
- Rated highly → preference increases

Preferences influence ranking but **never** override intent, progression or
safety.

### 3.7 Sequencing

`Preparation → Power/Skill → Anchor → Secondary Compound → Accessories →
Isolation → Conditioning → Cooldown`

The highest neurological demand always comes first. Antagonist supersets are
used on time-limited sessions. Density formats remain responsible for sessions
under 30 minutes.

### 3.8 Recovery Session Path

When readiness is extremely poor, the engine may generate a dedicated **recovery
session** instead of a normal training session.

Recovery sessions may include:
- mobility
- tissue preparation
- light pump work
- Zone 2 conditioning
- breathing
- extended recovery work

This remains an intentional coaching decision rather than simply reducing
intensity.

### 3.9 Elite Rubric

Every generated session is tested automatically.

**Reasoned**
- no filler
- every exercise has a meaningful reason

**Right Hard**
- prescription matches stimulus
- weekly volume within targets

**Balanced & Injury Smart**
- prohibited movements never appear
- antagonist balance maintained
- recency rules respected

**Goes Somewhere**
- anchor frozen
- progression earned
- deloads triggered correctly

**Session Coherence**
- session has one clear identity
- all exercises reinforce the intended theme
- no disconnected programming decisions

A permanent **dogfood battery** generates large numbers of realistic requests
after every engine change. Every session should be readable by an experienced
coach without obvious programming flaws.

---

## 4. Build Order

1. Athlete model
2. Intent blueprint
3. Anchor & progression
4. Curated pools and ranking
5. Stimulus prescription and volume landmarks
6. Balance and safety
7. Recovery session path
8. Elite rubric and dogfood battery

Each phase is developed **test-first**. Each phase is independently shippable.
No phase proceeds until tests pass.

---

## 5. Parked for Later

- Recency window (proposed: no repeat within two sessions)
- Exact MRV table per muscle group
- Experience inferred before confirmation
- Injury entry UX
- Future AI coaching layer (optional, never required for core programming)
