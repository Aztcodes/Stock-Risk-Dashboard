# Aztic — Claude Code Context

## What This Is

AI-powered stock ratings dashboard. User enters a ticker → Anthropic Claude API fetches live market data via web search → renders a 2-page risk report (Overview + Earnings & Outlook) with valuation, financial health, growth, catalysts, risks, and an Aztic score (0–100).

**Live:** https://stock-risk-dashboard-five.vercel.app/
**GitHub:** https://github.com/Aztcodes/Stock-Risk-Dashboard
**Stack:** Vercel Edge Runtime · Supabase (auth + PostgreSQL) · Anthropic Claude API

---

## Project Status

**Personal tool (May 2026).** Stage 2 is complete and live. Stage 3 (monetisation) is paused indefinitely — market too crowded with free alternatives. Aztic is iterated on for personal use only. See `ROADMAP.md` for full history.

---

## Architecture

### API endpoints (`api/`)

| File | Purpose |
|---|---|
| `fetch.js` | Streams Claude report. Auth-gated. Rate-limited 10/hr/user. |
| `price.js` | Live price + 52W range from Yahoo Finance v8. No auth. |
| `share.js` | Saves report JSON to `shared_reports` with a 10-char hash. Auth-gated. |
| `config.js` | Returns `{ supabaseUrl, supabaseAnonKey }` to frontend. |

### Frontend (`public/index.html`)

Single HTML file — all CSS, JS, and HTML inline. Key globals:

- `_reportJSON` — raw JSON string streamed from Claude
- `_livePrice` — result from `api/price.js` (overlaid on render)
- `_shareHash` — cached per report, reset on new fetch
- `currentData` — parsed report object (set after `renderReport()`)
- `_supabase` — Supabase client (null in dev mode when no SUPABASE_URL)

Key functions: `fetchStock()`, `renderReport()`, `buildChart()`, `buildGauge()`, `saveHistory()`, `loadHistoryFromDB()`, `showApp()`, `showAuthScreen()`.

### Supabase DB tables

| Table | Purpose | RLS |
|---|---|---|
| `reports` | Report history per user | Own rows only |
| `fetch_log` | Rate limiting timestamps | Own rows only |
| `shared_reports` | Public share snapshots | Public SELECT, auth INSERT |

### Share links

`/r/:hash` rewrites to `public/share.html` via `vercel.json`. `share.html` calls `/api/config`, fetches from `shared_reports` by hash (no auth), renders the full report.

### Mobile

52px fixed header (hamburger + AZTIC brand) on ≤768px. Sidebar is off-canvas drawer (`left:-340px` → `left:0`). Closes automatically on fetch.

---

## Critical Rules — Do Not Change Without Discussion

- **`max_uses: 4` and `max_tokens: 8000` in `api/fetch.js`** — production-validated. Reducing either degrades report quality unacceptably.
- **Scoring rubric in SYSTEM_PROMPT** — pure Claude qualitative judgment. Valuation (0–35), Financial Health (0–35), Growth (0–30). Band anchors provide loose guidance; Claude uses all available data to score. Do not add deterministic anchors without discussion.
- **Auth guard pattern** — extract token from `Authorization` header, verify via `${SUPABASE_URL}/auth/v1/user`, extract `userData.id`. All protected routes follow this pattern.
- **No inline API key** — `ANTHROPIC_API_KEY` is server-side only, never exposed to frontend.

---

## Environment Variables (Vercel)

```
ANTHROPIC_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
```

Dev mode: if `SUPABASE_URL` is not set, auth is bypassed and history falls back to `localStorage`.

---

## Notes for Claude

- **Do not use Glob to search this repo.** `node_modules/` contains hundreds of packages and will flood and truncate Glob results, making project files appear missing. Always use `Read` with a direct known path (e.g. `Read api/fetch.js`, `Read public/index.html`).
- **Stage 3 is paused indefinitely.** Aztic is a personal tool. See `ROADMAP.md` for the full history and decision.
- **node_modules** is local-only (in `.gitignore`). It is not in the GitHub repo. Its presence in the local folder is expected and necessary for `vercel dev`.

---

## Key Files

```
api/
  fetch.js      — Claude streaming endpoint
  price.js      — Yahoo Finance price endpoint
  share.js      — Share link creation
  config.js     — Supabase config for frontend
public/
  index.html    — Entire frontend, served at /app
  share.html    — Public read-only report viewer (/r/:hash)
  terms.html    — Terms of Service
  privacy.html  — Privacy Policy
  landing.html  — (Batch 2, not yet built) Marketing page at /
ROADMAP.md        — Full product roadmap + decision gates
stage3_batches.md — Detailed Stage 3 batch specs (endpoints, schemas, quota logic)
FUTURE_IDEAS.md   — Backlog of post-Stage-3 ideas
vercel.json     — Route rewrite: /r/:hash → share.html
```
