# Aztic — Product Roadmap

## What It Is

A web-based dashboard that generates structured 2-page risk reports for individual stocks. The user enters a ticker, the app calls the Anthropic API (with `web_search`) to fetch live market data, and renders a comprehensive analysis covering valuation, financial health, growth, catalysts, and risks — with an overall risk score (0–100).

**Current status (May 2026): Personal tool.** Stage 3 (monetisation) is paused indefinitely. The market has too many free alternatives for a paid product to gain traction at this stage. Aztic is kept live for personal use and iterated on as needed.

**Original target users:** Retail investors with $5K–$500K portfolios who want clear, synthesised stock analysis without the complexity of Bloomberg or the noise of forums.

---

## Architecture (Current)

- **Frontend:** `public/index.html` — single-file, dark UI, two-page report toggle (Overview / Earnings & Outlook), inline SVG chart and gauge, sidebar with Data / History tabs; Quick Picks 3×3 grid; mobile-responsive off-canvas drawer
- **Backend:** `api/fetch.js` — Vercel Edge Runtime serverless function, streams response back to client; auth-gated, rate-limited (10/hr/user)
- **Price:** `api/price.js` — Edge function fetching live price, daily % change, and 52W range from Yahoo Finance v8 chart API; called in parallel with Claude, resolves in ~1–2s
- **Share:** `api/share.js` — auth-gated Edge function; saves report JSON to `shared_reports` table with a 10-char hash; public viewer at `/r/:hash` via `public/share.html`
- **Config:** `api/config.js` — returns Supabase URL + anon key to frontend (safe to expose)
- **API:** Anthropic `claude-sonnet-4-6` with `web_search_20250305` tool (max_uses: 4), prompt caching on system prompt
- **API key:** Server-side only (`process.env.ANTHROPIC_API_KEY`) — not user-supplied
- **Auth:** Supabase (email + Google OAuth); JWT tokens verified server-side on protected routes
- **DB:** Supabase PostgreSQL — `reports` (history), `fetch_log` (rate limiting), `shared_reports` (public share links); all with RLS
- **History:** Stored in Supabase `reports` table per user; one-time migration from `localStorage` on first login
- **Hosting:** Vercel (free Hobby tier), domain is `*.vercel.app` for now
- **Legal:** `public/terms.html`, `public/privacy.html` — linked from auth screen, sidebar, and report footer

**Cost per report:** ~$0.20–0.40 (4 web searches + accumulated input tokens + JSON output).

---

## Stage 1 — COMPLETE

Single-file BYOK HTML product (`StockRiskDashboard_v2_1.html`). No server, no auth, user supplied their own Anthropic API key. Validated the core product concept.

---

## Stage 2 — Hosted Multi-User App ✅ COMPLETE

**Launched:** May 2026  
**Goal:** 5+ friends/family use it and provide feedback

### Batch 1 — Quick Wins ✅ DONE
- API key UI removed from frontend (was vestigial after moving to server-side key)
- Cost optimisation assessed; decided to maintain current fetch settings (max_uses: 4, max_tokens: 8000) to preserve report quality

### Batch 2 — Auth ✅ DONE
- Supabase email + Google OAuth sign-in screen
- `/api/fetch` route protected — unauthenticated requests rejected (401)
- Sign-out button in sidebar header
- `api/config.js` Edge endpoint returns Supabase URL + anon key safely to frontend

### Batch 3 — DB + Rate Limiting + History Migration ✅ DONE
- Supabase tables: `reports` (history), `fetch_log` (rate limiting)
- History migrated from `localStorage` → user account in DB; one-time migration on first login
- Rate limiting: max 10 fetches/hour/user enforced server-side in `api/fetch.js`
- Row Level Security (RLS) policies: users can only access their own data

### Batch 4 — Mobile Responsive ✅ DONE
- Fixed top header bar (52px) with AZTIC brand + hamburger on mobile
- Sidebar becomes off-canvas drawer (slides in from left, closes on fetch or overlay tap)
- Report grids reflow: cards 1-col, KPI strip 4-col (2 rows), p2/dual 1-col, earnings 2×2
- Tablet breakpoint (769–1024px): sidebar 300px, cards 2-col

### Batch 5 — Share Links ✅ DONE
- `api/share.js`: auth-gated Edge function, generates 10-char hash, saves report JSON to `shared_reports` table
- `public/share.html`: public read-only viewer — fetches from Supabase REST (no auth), renders full 2-page report
- `vercel.json`: rewrites `/r/:hash` → `share.html`
- Share button in floating actions; modal with copyable URL; hash cached per session

### Batch 6 — Legal Pages ✅ DONE
- `public/terms.html` — Terms of Service (not-financial-advice callout, acceptable use, liability cap)
- `public/privacy.html` — Privacy Policy (data collected, third parties, retention, user rights)
- Links wired into auth screen footer, sidebar footer, and report page footer

**All batches shipped. Stage 2 complete.**

---

## Pre-Stage 3 — Planning & Preparation ✅ COMPLETE (not proceeding)

Planning was completed but Stage 3 was called off in May 2026. The full batch spec is preserved in `stage3_batches.md` for reference if the project is ever revisited.

---

## Stage 3 — Monetised SaaS ⛔ PAUSED INDEFINITELY

**Decision (May 2026):** Not proceeding. Market has too many free alternatives; paid traction unlikely without significant marketing investment that isn't justified at this stage. Aztic continues as a personal tool.

The pricing model, batch specs, and feature list designed for Stage 3 are archived in `stage3_batches.md`.

---

## Decision Gates

| Milestone | Date | Outcome |
|---|---|---|
| Stage 2 launch | End May 2026 | ✅ Complete |
| Stage 3 launch | — | ⛔ Paused — not proceeding |

---

## Key Decisions Made

- **Brand:** Aztic (clean, memorable, "tic" echoes stock ticks)
- **Auth/DB:** Supabase (all-in-one vs Clerk + separate DB)
- **API key:** Server-side only — not BYOK. Keeps UX simple for less experienced audience.
- **Free tier:** 1 report/week — weekly cadence for habit formation; stronger retention than a monthly cap
- **Schema as contract:** The 50+ field JSON schema is the single interface between backend and renderer. Provider-agnostic — could swap to OpenAI/Gemini in ~1–2 days.
- **No custom domain yet:** `*.vercel.app` is sufficient for Stage 2. Register and connect for Stage 3 launch.
