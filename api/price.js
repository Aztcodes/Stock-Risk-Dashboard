export const config = { runtime: 'edge' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get('ticker') || '').trim().toUpperCase().replace(/[^A-Z.]/g, '');

  if (!ticker || ticker.length > 10) {
    return new Response(JSON.stringify({ error: 'Invalid ticker' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`Yahoo Finance returned HTTP ${res.status}`);

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('No price data returned');

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;
    const w52Lo = meta.fiftyTwoWeekLow;
    const w52Hi = meta.fiftyTwoWeekHigh;

    return new Response(JSON.stringify({
      ticker,
      price,
      priceFormatted: `$${price.toFixed(2)}`,
      change,
      changePct,
      changePctFormatted: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
      isNeg: change < 0,
      week52High: w52Hi,
      week52Low: w52Lo,
      week52Formatted: `$${Math.round(w52Lo)} — $${Math.round(w52Hi)}`,
      marketState: meta.marketState ?? 'UNKNOWN',
      currency: meta.currency ?? 'USD',
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Price fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
