# Wordflow — Product Vision & Monetization Plan

Status: idea capture only. Nothing in this doc is implemented — it's a placeholder for when
the app moves from a personal Vercel demo toward an app-store release (iOS + Android).

## 1. What makes this different

Most Bible/QT apps fall into two buckets: (a) static devotional content written once and
reused for everyone, or (b) a plain reading-plan tracker with no generated commentary. Wordflow's
angle is combining both, personalized per user, per day:

- Daily reading position tracked per person (not a fixed calendar plan) — the cursor moves
  at whatever pace the user actually reads.
- The day's commentary (story summary, historical context, personal reflection) is written
  fresh by Claude every day, grounded in the actual passage text — not pre-written stock content.
- The passage text itself is available in two forms (verse-by-verse and continuous narrative)
  and two languages (English NLT + Claude-rendered Korean), with audio for every section.
- Liturgical awareness — the app should recognize Holy Week, Thanksgiving, Christmas, etc.
  and surface season-appropriate content for that week, then resume the normal reading
  cursor afterward without losing progress.
- A real reading-progress analytics view (cycles through the whole Bible completed, per-book
  read counts, pace-based projected completion date) — closer to a habit-tracking / analytics
  dashboard than a typical devotional app's static "day 47 of 365" counter.

No specific competitor audit has been done — this is a working hypothesis, not validated
market research. Worth a quick App Store / Play Store scan before committing engineering time.

## 2. Platform path

1. **Now** — Vercel web app, single user (you), used as a live demo/dogfood.
2. **Later** — package for iOS + Android. Options to evaluate when the time comes:
   PWA/Capacitor wrapper around the existing Next.js app (fastest, reuses everything) vs.
   React Native (better native feel, more rebuild work). Not decided — revisit once the
   web version's UX is proven out.

## 3. Accounts & subscription model (idea stage)

- **Auth**: email login (magic link or password — not decided). Current app has no auth at
  all (name-based profile only), so this is a prerequisite for multi-tenant / billing.
- **Trial**: 7 days free for every new signup, full feature access.
- **Tiers** (names/prices are placeholders, not final):

  | | Standard | Pro |
  |---|---|---|
  | Daily Claude-generated content | 1 generation/day | up to 5 regenerations/day |
  | Reading-progress analytics dashboard | basic (current streak, today's book) | full (cycle count, per-book history, pace projection, filters) |
  | Price | TBD — lower tier | TBD — higher tier |

  The in-app UI should visibly hint at what Pro unlocks (e.g. a locked/greyed dashboard
  section with an upgrade prompt) — the upsell surface matters as much as the feature gate.

- Regeneration behavior ties into the liturgical-calendar logic already scoped for the app
  itself (see the main improvement list): a special-occasion day's *first* generation shows
  the seasonal content; if the user regenerates that same day, subsequent regenerations
  fall back to normal curriculum-progress content, so Pro users who burn regenerations don't
  get stuck re-rolling the same holiday content instead of advancing.

## 4. Unit economics — Claude API cost vs. subscription price

This is a framework to plug real numbers into once there's usage data, not a final P&L.
Current app uses `claude-haiku-4.5` for daily content generation (theme/story/context/message
+ the Korean verse/story rendering) and `claude-sonnet-5` for the interactive chat assistant
(see `src/lib/ai/model.ts`). Pricing as of this doc (per Anthropic's published rates):

| Model | Input $/MTok | Output $/MTok |
|---|---|---|
| Claude Haiku 4.5 | $1.00 | $5.00 |
| Claude Sonnet 5 | $3.00 ($2.00 intro through 2026-08-31) | $15.00 ($10.00 intro) |

**Rough cost per daily generation** (one reading + one Korean passage render, both Haiku):
- Reading write-up (theme/story/context/message): ~1.5K input + ~0.8K output ≈ $0.006
- Korean passage (verses + story, grounded in NLT text): ~0.8K input + ~1.5K output ≈ $0.009
- **≈ $0.015 per generation.** A Pro user regenerating 5×/day worst-case: ≈ $0.075/day ≈ $2.25/month.
  A Standard user (1×/day): ≈ $0.015/day ≈ $0.45/month.

**Chat assistant** (Sonnet 5, only when the user opens the chat widget): a typical turn with
some context is roughly 1K input + 0.3K output ≈ $0.005/turn. This is bursty and
usage-dependent — not part of the daily baseline above.

**Not Claude cost, but real cost**: TTS (`openai/tts-1`) and transcription (`openai/whisper-1`)
are routed through the AI Gateway too and bill separately from Anthropic's rates — factor
those in once there's a pricing readout for them, since "listen to everything" was one of
the requested improvements and will drive real usage.

**Breakeven framing**: fixed monthly costs (Vercel hosting, Neon DB, domain) are small for
early usage — call it $20–40/month as a placeholder. Variable cost per user is small relative
to any plausible subscription price (~$0.50–2.50/month in Claude spend vs. a subscription
likely priced at $4.99–9.99/month), so gross margin per paying user should be healthy well
before scale — the real risk is trial-to-paid conversion and CAC, not API cost. Once there's
real usage data, replace the estimates above with `count_tokens` measurements against actual
prompts rather than the rough sizing used here.

## 5. Open questions (not decided, listed so they don't get lost)

- Exact Standard/Pro price points.
- Whether analytics-dashboard "reading in the 통독 tab" (user-initiated deep reading, using
  the NLT/API.Bible APIs directly rather than Claude) counts toward the same regeneration
  quota or is unlimited/separate.
- Auth provider (Clerk vs. Auth0 vs. rolling something minimal) — deferred until accounts
  are actually being built.
- iOS/Android packaging approach (PWA/Capacitor vs. React Native).
