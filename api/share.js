export const config = { runtime: 'edge' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  if (!process.env.SUPABASE_URL) {
    return new Response(JSON.stringify({ error: 'Share not available in dev mode' }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY || '' }
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const { reportJson } = body;
  if (!reportJson || typeof reportJson !== 'object') {
    return new Response(JSON.stringify({ error: 'reportJson is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const ticker = (reportJson.ticker || 'UNKNOWN').toUpperCase();
  const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 10);

  const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/shared_reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_ANON_KEY || '',
      'Authorization': `Bearer ${token}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ hash, ticker, report_json: reportJson }),
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    return new Response(JSON.stringify({ error: 'Failed to save: ' + err }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  return new Response(JSON.stringify({ hash }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
