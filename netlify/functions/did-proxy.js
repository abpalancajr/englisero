// Netlify Function — proxies ALL API calls server-side

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // ── TEST ENDPOINT — GET request shows key status ──
  if (event.httpMethod === 'GET') {
    const claudeKey = process.env.CLAUDE_API_KEY || '';
    const elevenKey = process.env.ELEVENLABS_API_KEY || '';
    const didEmail  = process.env.DID_EMAIL || '';
    const didKey    = process.env.DID_API_KEY || '';
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        CLAUDE_API_KEY:     claudeKey ? `SET (starts with: ${claudeKey.substring(0,12)}...)` : 'NOT SET',
        ELEVENLABS_API_KEY: elevenKey ? `SET (starts with: ${elevenKey.substring(0,8)}...)` : 'NOT SET',
        DID_EMAIL:          didEmail  ? `SET (${didEmail})` : 'NOT SET',
        DID_API_KEY:        didKey    ? `SET (length: ${didKey.length})` : 'NOT SET',
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { service, action, id, body: reqBody } = body;

    // ── CLAUDE ──────────────────────────────────────────────────
    if (service === 'claude') {
      const key = process.env.CLAUDE_API_KEY;
      if (!key) return errRes(corsHeaders, 'CLAUDE_API_KEY not set');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key.trim(),
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(reqBody)
      });
      const data = await response.json();
      return { statusCode: response.status, headers: corsHeaders, body: JSON.stringify(data) };
    }

    // ── ELEVENLABS ───────────────────────────────────────────────
    if (service === 'elevenlabs') {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) return errRes(corsHeaders, 'ELEVENLABS_API_KEY not set');

      const { voiceId, payload } = reqBody;
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key.trim() },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.text();
        return { statusCode: response.status, headers: corsHeaders, body: JSON.stringify({ error: errData }) };
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64 })
      };
    }

    // ── D-ID ─────────────────────────────────────────────────────
    if (service === 'did') {
      const didEmail = process.env.DID_EMAIL;
      const didKey   = process.env.DID_API_KEY;
      if (!didEmail || !didKey) return errRes(corsHeaders, 'DID_EMAIL or DID_API_KEY not set');

      const authHeader = 'Basic ' + Buffer.from(didEmail.trim() + ':' + didKey.trim()).toString('base64');

      if (action === 'create') {
        const response = await fetch('https://api.d-id.com/talks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify(reqBody)
        });
        const data = await response.json();
        return { statusCode: response.status, headers: corsHeaders, body: JSON.stringify(data) };
      }

      if (action === 'poll') {
        const response = await fetch(`https://api.d-id.com/talks/${id}`, {
          headers: { 'Authorization': authHeader }
        });
        const data = await response.json();
        return { statusCode: response.status, headers: corsHeaders, body: JSON.stringify(data) };
      }
    }

    return errRes(corsHeaders, 'Unknown service: ' + service);

  } catch (e) {
    console.error('Proxy error:', e);
    return errRes(corsHeaders, e.message);
  }
};

function errRes(headers, message) {
  return { statusCode: 500, headers, body: JSON.stringify({ error: message }) };
}
