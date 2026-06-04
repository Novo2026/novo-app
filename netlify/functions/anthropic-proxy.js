const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const origin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigins = [
    'https://novo.windmillmortgage.com',
    'https://windmill-novo.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  if (origin && !allowedOrigins.some(o => origin.startsWith(o))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { model, max_tokens, messages, system } = body;

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const requestParams = {
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(max_tokens || 4096, 8192),
      messages,
    };

    if (system) requestParams.system = system;

    const response = await client.messages.create(requestParams);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Anthropic proxy error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API request failed', message: error.message }),
    };
  }
};
