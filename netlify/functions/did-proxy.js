// Netlify Function — proxies ALL API calls server-side
// Handles Claude, ElevenLabs, and D-ID
// All API keys live here as Netlify environment variables — never in the browser

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const { service, action, id, body: reqBody } = JSON.parse(event.body || '{}');

    // ── CLAUDE ──────────────────────────────────────────────────
    if (service === 'claude') {
      const key = process.env.CLAUDE_API_KEY;
      if (!key) return errRes(corsHeaders, 'CLAUDE_API_KEY not set in Netlify environment variables');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
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
      if (!key) return errRes(corsHeaders, 'ELEVENLABS_API_KEY not set in Netlify environment variables');

      const { voiceId, payload } = reqBody;
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
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

      const authHeader = 'Basic ' + Buffer.from(didEmail + ':' + didKey).toString('base64');

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
