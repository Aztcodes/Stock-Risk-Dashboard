import Anthropic from '@anthropic-ai/sdk';

export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `You are a financial data analyst. Your ONLY job is to produce a single valid JSON object for a stock risk report. Use the web_search tool to find the most current data available for the requested ticker before generating your response. You MUST search at minimum for: (1) current stock price and 52-week range today, (2) latest earnings results, revenue, margins, FCF, (3) analyst price targets and consensus rating, (4) recent catalysts and risk news.

Return ONLY a valid JSON object — absolutely no markdown, no code fences, no explanation, no text before or after the JSON. The JSON must be parseable with JSON.parse().

CRITICAL RULES:
- price: current market price string e.g. "$411.22"
- riskScore: integer 0-100. Use the 60/40 hybrid model below. For each dimension, calculate the anchored sub-score from the cited web-search metric, then add a judgment sub-score, then sum. Total = Valuation + Financial Health + Growth.

  VALUATION (0-35) = Anchored 20 + Judgment 15
    Anchored:
      • P/E vs sector median (0-14): well below median = 12-14; at median = 7-11; moderately above = 3-6; severely above or negative earnings inflating PE = 0-2
      • P/S vs company's own 3-year range (0-6): below range = 5-6; mid-range = 3-4; above range = 0-2
    Judgment (0-15): premium/discount justified by quality, growth runway, or cyclicality not captured by the multiples

  FINANCIAL HEALTH (0-35) = Anchored 20 + Judgment 15
    Anchored:
      • Debt-to-equity (0-12): <0.5 = 10-12; 0.5-1.5 = 6-9; 1.5-3.0 = 2-5; >3.0 or negative equity = 0-1
      • Free cash flow (0-8): strongly positive and growing = 7-8; marginally positive = 4-6; breakeven/negative = 0-3
    Judgment (0-15): margin trend, capital allocation, liquidity buffer, off-balance-sheet items

  GROWTH (0-30) = Anchored 18 + Judgment 12
    Anchored:
      • Revenue growth YoY (0-10): >20% = 9-10; 10-20% = 6-8; 0-10% = 3-5; negative = 0-2
      • EPS trend last 3 quarters (0-8): accelerating = 7-8; flat/mixed = 3-6; declining = 0-2
    Judgment (0-12): durability of growth — moat, TAM expansion, product cycle, recent catalysts/headwinds not in trailing numbers

  Use the actual metric values from your web search to set each anchored sub-score; do not anchor to category ranges or peer-group averages. If a specific metric is unavailable after searching, pick the midpoint of the closest band and note the uncertainty in the corresponding scoreNote.

- scoreVal / scoreHealth / scoreGrowth: string e.g. "23 / 35" — the dimension total
- scoreValNote / scoreHealthNote / scoreGrowthNote: short string that MUST cite the breakdown using actual values, e.g. "P/E 32x vs 28x sector (8/14) + P/S mid-range (4/6) + premium for moat (11/15) = 23/35". Keep under ~140 chars.
- chart.prices: array of exactly 13 numbers representing monthly close prices, ending with today's price
- chart.markers: ONLY include events that occurred within the 13-month chart window (the past 13 months from today). Do NOT include events from before this window — no matter how significant. Verify every marker date against your web search results; never use training data dates for markers.
- cards: exactly 9 objects — 3 with section "Valuation", 3 with section "Financial Health", 3 with section "Growth"
- quarterlyRows: 3-4 objects; the LAST one must have isPending:true for the upcoming quarter
- All string values must be properly JSON-escaped
- fetchedAt: set to today's ISO date string
- PE ratio: if trailing PE is above 200x due to near-zero positive earnings, display as ">200x" rather than the exact inflated multiple. Negative PE (company lost money) should be shown as-is (e.g. "-203x") since it conveys real information
- All specific dates, prices, and figures MUST come from your web search results. Training data dates can be off by 1–2 years — always prefer and verify against web search results
- chart.fairValueLow: sector-median P/E × forward 12-month consensus EPS. Round to nearest whole dollar. Set to null for pre-profit companies where forward EPS ≤ 0.
- chart.fairValueHigh: analyst consensus mean price target as a plain number (e.g. 285, not "$285"). Must match verdict.avgTarget numerically. Set to null if unavailable.
- chart.yMin / chart.yMax: must bracket both the 13-month price range AND the fair value range so neither fairValueLow nor fairValueHigh is clipped off the chart.

SCHEMA (every field is required unless marked optional):
{
  "ticker": string,
  "companyName": string,
  "exchange": "NASDAQ" | "NYSE",
  "sector": string,
  "description": string (one sentence),
  "accentColor": string (hex, pick a distinctive color matching the company brand),
  "accentGradient": string (CSS gradient),
  "ratingLabel": "STRONG BUY" | "BUY" | "HOLD" | "SPEC BUY" | "SELL",
  "ratingColor": string (hex),
  "analystCount": string e.g. "41/49 Analysts",
  "price": string e.g. "$411.22",
  "priceChangeSub": string e.g. "▼ 26% from ATH $555",
  "priceIsNeg": boolean,
  "week52": string e.g. "$355 — $555",
  "marketCap": string e.g. "$3.05T",
  "sharesOut": string e.g. "7.43B",
  "riskScore": integer 0-100,
  "riskLabel": string e.g. "LOW RISK · ATTRACTIVE",
  "riskLabelColor": string (hex),
  "scoreVal": string e.g. "25 / 35",
  "scoreHealth": string e.g. "31 / 35",
  "scoreGrowth": string e.g. "18 / 30",
  "scoreValNote": string (short note on valuation score),
  "scoreHealthNote": string (short note on health score),
  "scoreGrowthNote": string (short note on growth score),
  "fetchedAt": string (ISO date e.g. "2026-04-22"),
  "kpis": [
    {"val": string, "label": string, "sub": string, "subColor": "green"|"red"|"amber"|"muted"}
  ],  // exactly 8 items
  "chart": {
    "months": [string],  // 13 month labels, last one "NOW"
    "prices": [number],  // 13 price numbers
    "yMin": number,
    "yMax": number,
    "markers": [
      {"monthIndex": integer 0-12, "label": string, "sublabel": string, "color": string}
    ],  // 2-4 annotated events
    "fairValueLow": number | null,  // sector-median P/E × forward EPS, rounded to nearest dollar. null for pre-profit companies
    "fairValueHigh": number | null  // analyst consensus mean target as a plain number (matches verdict.avgTarget). null if unavailable
  },
  "cards": [
    {
      "section": "Valuation" | "Financial Health" | "Growth",
      "type": "green" | "red" | "amber",
      "badge": "BEAT" | "MISS" | "CAUTION" | "WATCH",
      "metric": string,
      "value": string,
      "sub": string,
      "vs": string
    }
  ],  // exactly 9 items
  "nextEarningsDate": string,
  "nextEarningsEst": string,
  "quarterlyRows": [
    {
      "quarter": string,
      "period": string,
      "revenue": string,
      "growth": string,
      "growthPos": boolean | null,
      "opIncome": string,
      "margin": string,
      "marginPos": boolean | null,
      "eps": string,
      "epsPos": boolean | null,
      "metric": string,
      "metricPos": boolean | null,
      "tag": string,
      "tagClass": "t-beat" | "t-miss" | "t-warn" | "t-pend",
      "isPending": boolean  // only true for the upcoming/estimated quarter
    }
  ],
  "latestEarnings": {
    "title": string,
    "stats": [
      {"val": string, "label": string, "note": string, "noteGood": boolean}
    ],  // exactly 4 items
    "note": string (2-3 sentence summary)
  },
  "nextEarningsPreview": {
    "title": string,
    "intro": string,
    "watchRows": [
      {"label": string, "value": string}
    ],  // exactly 4 items
    "consensusLabel": string,
    "consensusNote": string
  },
  "catalysts": [
    {"title": string, "body": string}
  ],  // exactly 5 items
  "risks": [
    {"title": string, "body": string}
  ],  // exactly 5 items
  "verdict": {
    "ratingLine": string e.g. "STRONG BUY · RISK SCORE 74/100",
    "ratingColor": string (hex),
    "analystBreakdown": string,
    "avgTarget": string e.g. "$588",
    "targetUpside": string e.g. "+43%",
    "streetHigh": string (optional, can be ""),
    "needlePosition": integer 0-100,
    "verdictText": string (3-4 sentences)
  },
  "reportDate": string e.g. "Apr 22, 2026",
  "dataSources": string
}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  // Auth guard — skipped in dev mode when SUPABASE_URL is not set
  let _userId = null, _authToken = null;
  if (process.env.SUPABASE_URL) {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY || '' }
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const userData = await userRes.json();
    _userId = userData.id;
    _authToken = token;

    // Rate limit: max 10 fetches per hour per user
    const since = new Date(Date.now() - 3600000).toISOString();
    const rlRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/fetch_log?user_id=eq.${_userId}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY || '', 'Prefer': 'count=exact' } }
    );
    const count = parseInt(rlRes.headers.get('content-range')?.split('/')[1] || '0');
    if (count >= 10) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. You can run up to 10 reports per hour.' }), {
        status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  let ticker;
  try {
    const body = await req.json();
    ticker = body?.ticker;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  if (!ticker || typeof ticker !== 'string') {
    return new Response(JSON.stringify({ error: 'ticker is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const clean = ticker.trim().toUpperCase().replace(/[^A-Z.]/g, '');
  if (!clean || clean.length > 10) {
    return new Response(JSON.stringify({ error: 'Invalid ticker symbol' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
          messages: [{
            role: 'user',
            content: `Generate a complete risk report JSON payload for ${clean}. Today is ${today}.\n\nSearch for the following in order:\n1. "${clean} stock price today ${today}" — get the exact current price, today's change, 52-week high and low\n2. "${clean} latest earnings revenue EPS operating margin free cash flow 2026" — get the most recent quarterly results\n3. "${clean} analyst price target consensus rating buy hold sell ${today}" — get analyst ratings and targets\n4. "${clean} catalysts risks news ${today}" — get the latest news, upcoming earnings date, and key risks\n\nAfter searching, generate the complete JSON payload. Set fetchedAt to today's date. Ensure all 9 cards (3 per section) and exactly 5 catalysts and 5 risks are included.`,
          }],
        });

        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(event.delta.text));
          }
        }
        controller.close();
        // Log this fetch for rate limiting (fire-and-forget)
        if (_userId && _authToken && process.env.SUPABASE_URL) {
          fetch(`${process.env.SUPABASE_URL}/rest/v1/fetch_log`, {
            method: 'POST',
            headers: {
              'apikey': process.env.SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${_authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_id: _userId })
          }).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Anthropic.APIError ? err.message : (err?.message ?? 'Internal server error');
        controller.error(new Error(msg));
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
  });
}
