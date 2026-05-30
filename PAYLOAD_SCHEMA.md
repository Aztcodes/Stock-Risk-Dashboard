# Aztic — JSON Payload Schema Reference

Use this document when generating a payload for the Aztic dashboard. The payload must be a single valid JSON object parseable by `JSON.parse()` — no markdown, no code fences, no trailing text.

---

## Scoring Model

The **Aztic Score** (0–100) is the sum of three dimensions scored by qualitative judgment:

| Dimension | Max | Band guidance |
|---|---|---|
| Valuation | 35 | 30–35 deeply undervalued · 20–29 fair · 10–19 expensive · 0–9 severely overvalued |
| Financial Health | 35 | 30–35 fortress · 20–29 solid · 10–19 leveraged · 0–9 distressed |
| Growth | 30 | 25–30 accelerating strongly · 15–24 steady · 5–14 slowing · 0–4 declining |

Score using all available data and judgment — not rigid formulas.

---

## Full Schema

Every field is required unless marked **optional**.

```json
{
  "ticker": "string — e.g. \"MSFT\"",
  "companyName": "string — full legal name",
  "exchange": "\"NASDAQ\" | \"NYSE\"",
  "sector": "string — e.g. \"Cloud Computing · Enterprise Software · AI\"",
  "description": "string — one sentence describing what the company does",
  "accentColor": "string — hex color matching company brand e.g. \"#00a4ef\"",
  "accentGradient": "string — CSS gradient e.g. \"linear-gradient(135deg, #00a4ef 0%, #0067b8 100%)\"",

  "ratingLabel": "\"STRONG BUY\" | \"BUY\" | \"HOLD\" | \"SPEC BUY\" | \"SELL\"",
  "ratingColor": "string — hex matching the rating (green for buy, amber for hold, red for sell)",
  "analystCount": "string — e.g. \"35/38 Analysts\"",

  "price": "string — e.g. \"$415.12\"",
  "priceChangeSub": "string — e.g. \"▼ 25% from ATH $555\" or \"▲ 12% YTD\"",
  "priceIsNeg": "boolean — true if priceChangeSub is negative",
  "week52": "string — e.g. \"$356 — $555\"",
  "marketCap": "string — e.g. \"$3.05T\"",
  "sharesOut": "string — e.g. \"7.43B\"",

  "riskScore": "integer 0–100 (Valuation + Financial Health + Growth)",
  "riskLabel": "string — e.g. \"LOW RISK · ATTRACTIVE\"",
  "riskLabelColor": "string — hex",

  "scoreVal": "string — e.g. \"25 / 35\"",
  "scoreHealth": "string — e.g. \"31 / 35\"",
  "scoreGrowth": "string — e.g. \"20 / 30\"",
  "scoreValNote": "string — short summary of valuation score drivers, under ~140 chars",
  "scoreHealthNote": "string — short summary of health score drivers, under ~140 chars",
  "scoreGrowthNote": "string — short summary of growth score drivers, under ~140 chars",

  "fetchedAt": "string — ISO date e.g. \"2026-05-30\"",
  "reportDate": "string — e.g. \"May 30, 2026\"",

  "kpis": [
    // exactly 8 items
    { "val": "string", "label": "string", "sub": "string", "subColor": "\"green\" | \"red\" | \"amber\" | \"muted\"" }
  ],

  "chart": {
    "months": ["string"],
    // exactly 13 month labels, last one must be "NOW"
    // e.g. ["May 25","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan 26","Feb","Mar","Apr","NOW"]

    "prices": [number],
    // exactly 13 monthly close prices, ending with today's price

    "yMin": "number — must be low enough to show all prices AND fairValueLow without clipping",
    "yMax": "number — must be high enough to show all prices AND fairValueHigh without clipping",

    "markers": [
      // 2–4 annotated events within the 13-month window only. Never use events outside this range.
      { "monthIndex": "integer 0–12", "label": "string", "sublabel": "string", "color": "string hex" }
    ],

    "fairValueLow": "number | null — sector-median P/E × forward 12-month consensus EPS, rounded to nearest dollar. null for pre-profit companies (forward EPS ≤ 0)",
    "fairValueHigh": "number | null — analyst consensus mean price target as a plain number (e.g. 285, not \"$285\"). Must match verdict.avgTarget numerically. null if unavailable"
  },

  "cards": [
    // exactly 9 items — 3 per section (Valuation, Financial Health, Growth)
    {
      "section": "\"Valuation\" | \"Financial Health\" | \"Growth\"",
      "type": "\"green\" | \"red\" | \"amber\"",
      "badge": "\"BEAT\" | \"MISS\" | \"CAUTION\" | \"WATCH\"",
      "metric": "string",
      "value": "string",
      "sub": "string — 1–2 sentence explanation",
      "vs": "string — benchmark e.g. \"Sector median ~35x\""
    }
  ],

  "nextEarningsDate": "string — e.g. \"Jul 28, 2026 (after close)\"",
  "nextEarningsEst": "string — e.g. \"Q4 FY2026 · Revenue guidance $86.7–87.8B · EPS est. ~$4.50\"",

  "quarterlyRows": [
    // 3–4 items; the LAST one must be the upcoming/estimated quarter with isPending: true
    {
      "quarter": "string — e.g. \"Q3 FY26\"",
      "period": "string — e.g. \"Mar 2026\"",
      "revenue": "string",
      "growth": "string — e.g. \"+18%\"",
      "growthPos": "boolean | null (null for pending)",
      "opIncome": "string",
      "margin": "string — e.g. \"46%\"",
      "marginPos": "boolean | null",
      "eps": "string",
      "epsPos": "boolean | null",
      "metric": "string — a key segment metric e.g. \"Azure +35% CC\"",
      "metricPos": "boolean | null",
      "tag": "string — e.g. \"BEAT\" | \"MISS\" | \"PENDING\"",
      "tagClass": "\"t-beat\" | \"t-miss\" | \"t-warn\" | \"t-pend\"",
      "isPending": "boolean — true only for the upcoming quarter"
    }
  ],

  "latestEarnings": {
    "title": "string — e.g. \"Q3 FY2026 — Reported Apr 29, 2026\"",
    "stats": [
      // exactly 4 items
      { "val": "string", "label": "string", "note": "string", "noteGood": "boolean" }
    ],
    "note": "string — 2–3 sentence summary of the earnings result"
  },

  "nextEarningsPreview": {
    "title": "string — e.g. \"Q4 FY2026 Preview — Jul 28, 2026\"",
    "intro": "string — 2–3 sentences on what to watch",
    "watchRows": [
      // exactly 4 items
      { "label": "string", "value": "string" }
    ],
    "consensusLabel": "string — e.g. \"Strong Buy\"",
    "consensusNote": "string — analyst count, avg target, high target, bull/bear summary"
  },

  "catalysts": [
    // exactly 5 items
    { "title": "string", "body": "string — 2–4 sentences" }
  ],

  "risks": [
    // exactly 5 items
    { "title": "string", "body": "string — 2–4 sentences" }
  ],

  "verdict": {
    "ratingLine": "string — e.g. \"STRONG BUY · RISK SCORE 76/100\"",
    "ratingColor": "string — hex",
    "analystBreakdown": "string — e.g. \"35 Buy · 3 Hold · 0 Sell (of 38 analysts)\"",
    "avgTarget": "string — e.g. \"$569\"",
    "targetUpside": "string — e.g. \"+37%\"",
    "streetHigh": "string — optional, can be \"\"",
    "needlePosition": "integer 0–100 (same as riskScore)",
    "verdictText": "string — 3–4 sentences synthesising the investment case"
  },

  "dataSources": "string — comma-separated list of sources used e.g. \"Microsoft Q3 FY26 Earnings · Yahoo Finance · MarketBeat\""
}
```

---

## Key Rules

- `chart.months` must be exactly 13 entries; the last must be `"NOW"`
- `chart.prices` must be exactly 13 numbers; the last is today's price
- `chart.markers` — only events that occurred within the 13-month window; verify dates against real data
- `chart.fairValueHigh` must match `verdict.avgTarget` as a plain number
- `chart.yMin` / `chart.yMax` must bracket both the price range and fair value range so nothing is clipped off the chart
- `kpis` — exactly 8 items
- `cards` — exactly 9 items (3 × Valuation, 3 × Financial Health, 3 × Growth)
- `latestEarnings.stats` — exactly 4 items
- `nextEarningsPreview.watchRows` — exactly 4 items
- `catalysts` — exactly 5 items
- `risks` — exactly 5 items
- All string values must be valid JSON (escape quotes, no unescaped newlines)
