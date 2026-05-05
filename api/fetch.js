import Anthropic from '@anthropic-ai/sdk';

export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `You are a financial data analyst. Your ONLY job is to produce a single valid JSON object for a stock risk report. Use the web_search tool to find the most current data available for the requested ticker before generating your response. You MUST search at minimum for: (1) current stock price and 52-week range today, (2) latest earnings results, revenue, margins, FCF, (3) analyst price targets and consensus rating, (4) recent catalysts and risk news.

Return ONLY a valid JSON object — absolutely no markdown, no code fences, no explanation, no text before or after the JSON. The JSON must be parseable with JSON.parse().

CRITICAL RULES:
- price: current market price string e.g. "$411.22"
- riskScore: integer 0-100. Base on: Valuation (35pts) + Financial Health (35pts) + Growth (30pts). Pre-revenue/speculative = 20-40. Profitable mega-cap = 60-85.
- chart.prices: array of exactly 13 numbers representing monthly close prices, ending with today's price
- cards: exactly 9 objects — 3 with section "Valuation", 3 with section "Financial Health", 3 with section "Growth"
- quarterlyRows: 3-4 objects; the LAST one must have isPending:true for the upcoming quarter
- All string values must be properly JSON-escaped
- fetchedAt: set to today's ISO date string

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
    ]  // 2-4 annotated events
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

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker } = req.body ?? {};
  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'ticker is required' });
  }

  const clean = ticker.trim().toUpperCase().replace(/[^A-Z.]/g, '');
  if (!clean || clean.length > 10) {
    return res.status(400).json({ error: 'Invalid ticker symbol' });
  }

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 4,
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Generate a complete risk report JSON payload for ${clean}. Today is ${today}.\n\nSearch for the following in order:\n1. "${clean} stock price today ${today}" — get the exact current price, today's change, 52-week high and low\n2. "${clean} latest earnings revenue EPS operating margin free cash flow 2026" — get the most recent quarterly results\n3. "${clean} analyst price target consensus rating buy hold sell ${today}" — get analyst ratings and targets\n4. "${clean} catalysts risks news ${today}" — get the latest news, upcoming earnings date, and key risks\n\nAfter searching, generate the complete JSON payload. Set fetchedAt to today's date. Ensure all 9 cards (3 per section) and exactly 5 catalysts and 5 risks are included.`,
        },
      ],
    });

    return res.status(200).json(message);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status ?? 500).json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
}
