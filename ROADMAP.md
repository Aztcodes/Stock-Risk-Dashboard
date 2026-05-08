# Aztic — Product Roadmap

## What It Is

A web-based dashboard that generates structured 2-page risk reports for individual stocks. The user enters a ticker, the app calls the Anthropic API (with `web_search`) to fetch live market data, and renders a comprehensive analysis covering valuation, financial health, growth, catalysts, and risks — with an overall risk score (0–100).

**Target users:** Retail investors with $5K–$500K portfolios who want clear, synthesised stock analysis without the complexity of Bloomberg or the noise of forums. Also investment clubs and finance students. The audience skews toward less experienced investors, so UX simplicity is a priority.

---

## Architecture (Current)

- **Frontend:** `public/index.html` — single-file, dark UI, two-page report toggle (Overview / Earnings & Outlook), inline SVG chart and gauge, sidebar with Data / History tabs; Quick Picks 3×3 grid
- **Backend:** `api/fetch.js` — Vercel Edge Runtime serverless function, streams response back to client
- **Price:** `api/price.js` — Edge function fetching live price, daily % change, and 52W range from Yahoo Finance v8 chart API; called in parallel with Claude, resolves in ~1–2s
- **API:** Anthropic `claude-sonnet-4-6` with `web_search_20250305` tool (max_uses: 4), prompt caching on system prompt
- **API key:** Server-side only (`process.env.ANTHROPIC_API_KEY`) — not user-supplied
- **History:** Currently in `localStorage` as `srr_history` — to be migrated to user account in Batch 3
- **Hosting:** Vercel (free Hobby tier), domain is `*.vercel.app` for now
- **Auth:** Supabase (email + Google OAuth) — implemented in Batch 2

**Cost per report:** ~$0.20–0.40 (4 web searches + accumulated input tokens + JSON output). This informs the Stage 3 free tier design — free tier should be capped at reports per month, not per day.

---

## Stage 1 — COMPLETE

Single-file BYOK HTML product (`StockRiskDashboard_v2_1.html`). No server, no auth, user supplied their own Anthropic API key. Validated the core product concept.

---

## Stage 2 — Hosted Multi-User App

**Target:** End May 2026  
**Goal:** 5+ friends/family using it weekly within 14 days of launch

### Batch 1 — Quick Wins ✅ DONE
- API key UI removed from frontend (was vestigial after moving to server-side key)
- Cost optimisation assessed; decided to maintain current fetch settings (max_uses: 4, max_tokens: 8000) to preserve report quality

### Batch 2 — Auth (foundational dependency)
Everything downstream requires a user identity. Nothing in Batches 3 or 5 can start until this is done.

- **Provider: Supabase** (chosen over Clerk — provides auth + PostgreSQL in one service, eliminating the need for a separate database)
- Email + Google OAuth sign-in
- Protect the `/api/fetch` route — unauthenticated requests should be rejected

### Batch 3 — DB + Rate Limiting + History Migration
All three share the same Supabase database and all depend on Batch 2 auth being in place.

- Set up Supabase DB schema (users, reports/history, fetch rate tracking)
- Migrate history from `localStorage` → user account in DB
- Enforce rate limiting server-side in `api/fetch.js` (max 10 fetches/hour/user)

### Batch 4 — Mobile Responsive
Independent of auth/DB — pure frontend CSS work. Can be done in parallel with any other batch.

- Sidebar collapses into a drawer on mobile
- Touch-friendly interactions
- `@media` breakpoints added (currently none exist)

### Batch 5 — Share Links
Depends on Batch 3 (DB must exist to store reports against a hash).

- Save rendered report to DB with a unique hash
- Serve at `/r/<ticker>/<hash>` as a public, read-only view

### Batch 6 — Legal Pages
Fully independent. Must be live before sharing beyond close friends.

- Terms of Service
- Privacy Policy
- "Not financial advice" disclaimer page

**Critical path: 1 → 2 → 3 → 5**  
Batches 4 and 6 can slot in alongside any of the above without blocking anything.

---

## Stage 3 — Monetised SaaS

**Target:** End July 2026  
**Gate:** Stage 2 retention >30% WoW before starting; 5 beta paid users committed before launch

### Pricing (revised from original plan)
At ~$0.20/report, the original "3 fetches/day" free tier is unviable (up to $18/month per free user in API costs). Revised model:

- **Free:** 3 reports/month — enough to genuinely evaluate the product, low cost exposure (~$0.60/month per free user)
- **Pro:** $9/month — capped at ~50–100 reports/month (protects against power-user edge cases)
- **Pro Annual:** $90/year

No BYOK tier — the target audience (less experienced investors) would find it intimidating and it undermines the "just enter a ticker" UX promise.

### Features
- Stripe integration (Free / Pro / Pro Annual tiers)
- Landing page with hero, sample reports, pricing, FAQ
- Watchlist feature + email staleness alerts
- Comparison mode (2–3 tickers side-by-side)
- SEO-friendly public report archive
- PostHog analytics

**MRR targets:** $450 MRR (50 paid users) by month 3 post-launch; $1,170 MRR by month 6

---

## Decision Gates

| Milestone | Date | Gate |
|---|---|---|
| Stage 2 launch | End May 2026 | 5+ friends/family using weekly within 14 days |
| First 25 active users | Mid June 2026 | Are users returning? |
| Stage 3 build start | Late June 2026 | Stage 2 retention >30% WoW |
| Stage 3 launch | End July 2026 | 5 beta paid users committed |
| Revenue target | End Sept 2026 | $450 MRR — invest in growth or pivot/pause |

---

## Key Decisions Made

- **Brand:** Aztic (clean, memorable, "tic" echoes stock ticks)
- **Auth/DB:** Supabase (all-in-one vs Clerk + separate DB)
- **API key:** Server-side only — not BYOK. Keeps UX simple for less experienced audience.
- **Free tier:** Reports/month cap (not per day) — cost-driven decision
- **Schema as contract:** The 50+ field JSON schema is the single interface between backend and renderer. Provider-agnostic — could swap to OpenAI/Gemini in ~1–2 days.
- **No custom domain yet:** `*.vercel.app` is sufficient for Stage 2. Register and connect for Stage 3 launch.
