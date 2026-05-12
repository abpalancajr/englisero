exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  try {
    const { action, id, body: reqBody } = JSON.parse(event.body || '{}');
    const DID_EMAIL   = process.env.DID_EMAIL;
    const DID_API_KEY = process.env.DID_API_KEY;
    if (!DID_EMAIL || !DID_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'D-ID credentials not set' }) };
    }
    const authHeader = 'Basic ' + Buffer.from(DID_EMAIL + ':' + DID_API_KEY).toString('base64');
    let url, method, fetchBody;
    if (action === 'create') {
      url = 'https://api.d-id.com/talks';
      method = 'POST';
      fetchBody = JSON.stringify(reqBody);
    } else if (action === 'poll') {
      url = `https://api.d-id.com/talks/${id}`;
      method = 'GET';
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      ...(fetchBody ? { body: fetchBody } : {})
    });
    const data = await response.json();
    return { statusCode: response.status, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
