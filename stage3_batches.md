# Aztic — Stage 3 Batch Plan ⛔ ARCHIVED

> **Status (May 2026): Not proceeding.** Stage 3 was paused indefinitely — market too crowded with free alternatives. This document is kept for reference only. Aztic is a personal tool.

---

**Original target:** End July 2026  
**Stack context:** Vercel Edge Runtime · Supabase (auth + PostgreSQL) · Anthropic Claude API · single-file frontend (`public/index.html`)

---

## Overview

| Batch | Focus | Launch-critical? |
|---|---|---|
| 1 | Billing & Subscriptions (Stripe) | Yes — hard gate |
| 2 | Landing Page, Custom Domain & Analytics | Yes |
| 3 | Watchlist & Email Alerts | No — post-launch OK |
| 4 | Comparison Mode | No — post-launch OK |
| 5 | SEO Report Archive | No — post-launch OK |

Recommended sequencing: ship Batches 1–2 by end of June (hard launch), then Batches 3–5 iteratively through July, informed by PostHog data.

---

## Pre-Batch — Aztic Scoring Model Refinement

**Goal:** Make the Aztic score more consistent and defensible before launch. Can be done independently of billing — a single SYSTEM_PROMPT edit in `api/fetch.js`.

### Current problem
The score (0–100) is currently based entirely on Claude's qualitative judgment applied to loose rubric anchors ("deeply undervalued," "fortress balance sheet"). This causes run-to-run variance that power users will notice.

### New model: 60/40 hybrid scoring

Each dimension is scored in two explicit steps, reported separately in the prompt, then summed:

| Dimension | Total | Anchored (deterministic) | Judgment (qualitative) |
|---|---|---|---|
| Valuation | 35 | 20 pts | 15 pts |
| Financial Health | 35 | 20 pts | 15 pts |
| Growth | 30 | 18 pts | 12 pts |

### Anchored metrics per dimension (from web search data)

**Valuation — 20 pts anchored:**
- P/E vs sector median: below median = 12–14 pts; at median = 7–11 pts; above median = 3–6 pts; severely above = 0–2 pts
- P/S vs company's own 3-year range: below range = 5–6 pts; within range = 3–4 pts; above range = 0–2 pts

**Financial Health — 20 pts anchored:**
- Debt-to-equity ratio: < 0.5 = 10–12 pts; 0.5–1.5 = 6–9 pts; 1.5–3.0 = 2–5 pts; > 3.0 or negative equity = 0–1 pts
- Free cash flow: strongly positive = 7–8 pts; marginally positive = 4–6 pts; breakeven/negative = 0–3 pts

**Growth — 18 pts anchored:**
- Revenue growth YoY: > 20% = 9–10 pts; 10–20% = 6–8 pts; 0–10% = 3–5 pts; negative = 0–2 pts
- EPS trend (last 3 quarters): accelerating = 7–8 pts; flat/mixed = 3–6 pts; declining = 0–2 pts

### Judgment component (15/15/12 pts)
Claude scores the remaining points based on qualitative factors the metrics don't capture: management quality, competitive moat, macro tailwinds/headwinds, recent news, and anything material not reflected in the trailing numbers. Claude must state its qualitative reasoning briefly alongside the score.

### SYSTEM_PROMPT implementation
In `api/fetch.js`, update the `riskScore` instruction to:
1. Instruct Claude to calculate anchored score first (citing the specific metric values found)
2. Then add qualitative judgment score (with brief reasoning)
3. Sum for the dimension total
4. Report sub-scores in `scoreVal`, `scoreHealth`, `scoreGrowth` fields (already in schema)

### Surface the methodology
Add a "How the Aztic Score works" tooltip or info modal in `public/index.html` explaining the 60/40 split in plain language. Publish the same on the landing page. This addresses the "feels arbitrary" criticism without building proprietary data pipelines.

---

## Batch 1 — Billing & Subscriptions

**Goal:** Revenue infrastructure. Gate for all other Stage 3 work.

### Stripe setup
- Create Stripe products and prices:
  - Free (no charge — no Stripe product needed)
  - Starter Pack: $5 one-time payment, 5 report credits, no expiry
  - Pro: $9/month recurring subscription, 30 reports/month
  - Pro Annual: $90/year recurring subscription, 30 reports/month
- Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Vercel environment variables
- Starter Pack is a one-time payment (`mode: 'payment'` in Checkout), not a subscription

### New API endpoint: `api/checkout.js`
- Auth-gated Edge function
- Creates a Stripe Checkout session for the requested plan
- Returns the Checkout URL; frontend redirects the user to it
- On completion, Stripe redirects back to `/app?upgraded=true`

### New API endpoint: `api/stripe-webhook.js`
- Listens for Stripe events:
  - `checkout.session.completed` — handles both subscription upgrades AND Starter Pack one-time purchases; distinguish via `session.mode` ('subscription' vs 'payment')
  - `customer.subscription.updated` — plan changes, renewals
  - `customer.subscription.deleted` — cancellations, downgrades to free
- Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
- On Starter Pack purchase: increment `report_credits` by 5 in `subscriptions` table
- On subscription event: sync `plan` and `status` in `subscriptions` table

### New API endpoint: `api/portal.js`
- Auth-gated Edge function
- Creates a Stripe Customer Portal session (handles cancellation, invoice history, plan changes)
- Returns portal URL; frontend redirects the user

### New Supabase table: `subscriptions`
```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free', -- 'free' | 'pro' | 'pro_annual'
  status text not null default 'active', -- 'active' | 'canceled' | 'past_due'
  report_credits integer not null default 0, -- Starter Pack credits; decremented on use
  period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: users can only read their own row
```

### Quota enforcement in `api/fetch.js`
- Replace current 10/hr rate limit with plan-aware quota logic
- Look up user's row from `subscriptions` table (default to free plan if no row exists)
- Priority order for allowing a fetch:
  1. **Pro / Pro Annual:** count reports in `fetch_log` since start of current calendar month — allow if < 30
  2. **Starter Pack credits:** if `report_credits` > 0, allow fetch and decrement `report_credits` by 1 (even if plan is 'free')
  3. **Free:** count reports in `fetch_log` since last Monday 00:00 UTC — allow if < 1
- Return 429 with `{ error: 'quota_exceeded', plan: 'free' | 'pro', credits: 0 }` when all paths exhausted (frontend uses this to show appropriate upgrade prompt)

### Frontend changes (`public/index.html`)
- Plan badge in sidebar header:
  - Free: "Free — 1 of 1 report used this week" (resets Monday)
  - Starter Pack credits remaining: "5 credits remaining"
  - Pro: "Pro — 12 of 30 reports used this month"
- Quota counter updates after each successful fetch
- Upgrade prompt modal fires when quota exhausted — two CTAs: "Get Starter Pack — $5" and "Go Pro — $9/month"
- "Upgrade to Pro" and "Get Starter Pack" buttons → call `api/checkout.js` with plan param → redirects to Stripe
- "Manage subscription" link in sidebar → calls `api/portal.js` → redirects to Stripe portal
- On return from Stripe (`?upgraded=true` or `?pack=true`), refresh plan badge

---

## Batch 2 — Landing Page, Custom Domain & Analytics

**Goal:** Public shopfront. Needed before any marketing or organic traffic can convert.

### New file: `public/landing.html`
Sections (all inline CSS/JS, dark design consistent with main app):
1. **Hero** — headline, subheadline, CTA button ("Try free — no credit card needed")
2. **Sample report** — static embedded excerpt of a real report (e.g. AAPL), showing the Aztic score gauge and key metrics
3. **Feature highlights** — 3–4 cards: Live data, AI analysis, Watchlist alerts, Comparison mode
4. **Pricing table** — Free / Pro / Pro Annual with feature comparison; CTA per tier
5. **FAQ** — 5–6 questions (What data sources? How often can I run reports? Is it financial advice? etc.)
6. **Footer** — links to Terms, Privacy, sign in

### Routing
- Add to `vercel.json`: unauthenticated requests to `/` serve `landing.html`; authenticated users go straight to `/app` (or the existing `index.html`)
- Alternatively: `index.html` checks auth on load and redirects to `landing.html` if logged out

### Custom domain
- Register domain (e.g. `aztic.co`) via preferred registrar
- Add domain in Vercel project settings → DNS records auto-generated
- Update Supabase Auth → Site URL and Redirect URLs to the new domain
- Update any hardcoded URLs in `share.html` and `index.html`

### PostHog analytics
- Add PostHog JS snippet to both `landing.html` and `index.html` (just before `</head>`)
- Add `POSTHOG_API_KEY` to Vercel env vars (or inline safely — PostHog keys are public-safe)
- Instrument key events:
  - `page_view` (auto-captured)
  - `signup_started` — when user clicks any sign-up CTA
  - `report_fetched` — after successful fetch in `fetchStock()`
  - `share_created` — after share link is generated
  - `upgrade_clicked` — when user clicks any upgrade CTA
  - `checkout_completed` — on return from Stripe with `?upgraded=true`

### SEO meta tags on `landing.html`
- Unique `<title>`, `<meta name="description">`, Open Graph `og:title` / `og:description` / `og:image`
- `og:image` should be a screenshot of a sample report (static PNG, committed to repo)

---

## Batch 3 — Watchlist & Email Alerts

**Goal:** Retention loop. Gives users a reason to come back without needing to remember tickers.

### New Supabase table: `watchlists`
```sql
create table watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  added_at timestamptz default now(),
  last_report_at timestamptz,
  alert_enabled boolean default true,
  unique(user_id, ticker)
);
-- RLS: users can only access their own rows
```

### Frontend changes (`public/index.html`)
- Add "Watchlist" tab to sidebar (alongside existing "History" tab)
- Watchlist tab shows saved tickers in a list; each row has:
  - Ticker name + last report date (or "Never")
  - "Fetch" button (one-click fetch, closes sidebar on mobile)
  - "Remove" button
  - Alert toggle (bell icon)
- "Add to Watchlist" button appears in floating actions after a report is rendered
- Free plan limit: 3 tickers. Pro: unlimited (enforce client-side + server-side)

### New API endpoint: `api/watchlist.js`
- Auth-gated
- `GET` — returns all watchlist entries for the user
- `POST` — adds a ticker; enforces free-tier limit
- `DELETE` — removes a ticker

### Email alerts: `api/alerts-cron.js`
- Vercel Cron job — runs daily at 08:00 UTC
- Configured in `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/alerts-cron", "schedule": "0 8 * * *" }] }
  ```
- Logic: query `watchlists` where `alert_enabled = true` and `last_report_at < now() - interval '7 days'` (or never fetched)
- Group by user, send one digest email per user listing stale tickers
- Use Resend (recommended) or Postmark for transactional email
- Add `RESEND_API_KEY` to Vercel env vars
- Email template: plain, on-brand — "3 stocks on your watchlist haven't been updated in 7+ days: AAPL, MSFT, TSLA. [Open Aztic →]"
- Update `last_report_at` in `watchlists` table after each successful fetch in `api/fetch.js`

---

## Batch 4 — Comparison Mode

**Goal:** Pro differentiation. Side-by-side analysis is the most visible "worth paying for" feature.

### UI changes (`public/index.html`)
- "Compare" mode toggle button in the top bar or input area
- In compare mode: input accepts 2–3 tickers (comma-separated or individual fields)
- "Fetch Comparison" button triggers parallel fetches
- Loading state shows progress per ticker independently
- Pro-only gate: free users see a locked state with upgrade prompt

### Parallel fetching
- Call `api/fetch.js` once per ticker simultaneously (Promise.all)
- Each fetch is streamed independently; render each column as it completes
- Each call counts as one report against the user's monthly quota

### Comparison renderer
- Side-by-side layout: one column per ticker (2–3 columns)
- Show simplified metrics per ticker: Aztic score gauge, Valuation, Health, Growth subscores, top 2 catalysts, top 2 risks
- Do not render the full 2-page report per ticker — use a condensed comparison card
- Responsive: on mobile, render as tabs (one tab per ticker) rather than side-by-side columns

### Notes
- Comparison reports are saved to `reports` history individually (one row per ticker)
- Share link for comparisons is out of scope for this batch — can be added later

---

## Batch 5 — SEO Report Archive

**Goal:** Top-of-funnel organic growth. Public pages for popular tickers drive search traffic and convert to signups.

### New file: `public/stock.html`
- Public read-only report viewer for a specific ticker
- On load: reads ticker from URL path (`/stock/AAPL`), fetches cached report from Supabase `public_reports` table
- Renders the full 2-page report (reuse renderer from `share.html`)
- CTA banner at top: "Get live analysis for any stock — free. [Sign up →]"
- No auth required to view

### Routing
- Add to `vercel.json`: `/stock/:ticker` → `public/stock.html`

### New Supabase table: `public_reports`
```sql
create table public_reports (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  report_json jsonb not null,
  generated_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: public SELECT, no INSERT/UPDATE from frontend (server-only writes)
```

### Seeding script: `scripts/seed-public-reports.js`
- One-off Node script (run locally or as a Vercel job)
- Generates reports for the top 50–100 tickers (e.g. S&P 100 list)
- Calls `api/fetch.js` with a service-role key, saves output to `public_reports`
- Should be re-run monthly to keep reports fresh

### SEO per page
- `stock.html` dynamically sets `<title>AAPL Stock Analysis — Aztic</title>` and meta description based on the fetched report data
- Open Graph image: generate a simple card showing ticker + Aztic score (can use a static template)
- Submit sitemap to Google Search Console once seed reports are live

### Notes
- Start with 20–30 tickers to validate SEO traction before seeding the full list
- Monitor which tickers drive signup conversions via PostHog before expanding

---

## Critical Rules (carry over from Stage 2)

- **`max_uses: 4` and `max_tokens: 8000` in `api/fetch.js`** — do not change. Production-validated.
- **Scoring rubric in SYSTEM_PROMPT** — per-dimension rubrics, not category anchors. Do not change.
- **Auth guard pattern** — extract token from `Authorization` header, verify via `${SUPABASE_URL}/auth/v1/user`. All protected routes follow this pattern including all new Batch 1 endpoints.
- **No inline API key** — `ANTHROPIC_API_KEY` is server-side only, never exposed to frontend.
- **Do not use Glob** — `node_modules/` will flood results. Use `Read` with direct known paths.
