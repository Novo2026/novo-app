const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Basic origin check — only allow requests from our own app
  const origin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigins = [
    'https://novo.windmillmortgage.com',
    'https://windmill-novo.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  if (origin && !allowedOrigins.some(o => origin.startsWith(o))) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { model, max_tokens, messages, system, stream } = body;

    if (!messages || !Array.isArray(messages)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request — messages required' }),
      };
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const requestParams = {
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(max_tokens || 1000, 4096), // cap at 4096
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
      body: JSON.stringify({
        error: 'API request failed',
        message: error.message
      }),
    };
  }
};
