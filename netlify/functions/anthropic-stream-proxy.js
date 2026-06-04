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
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { model, max_tokens, messages, system } = body;

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const requestParams = {
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(max_tokens || 1000, 4096),
      messages,
    };

    if (system) requestParams.system = system;

    // For Netlify functions, we collect the full response
    // Streaming via SSE requires a different setup
    const response = await client.messages.create(requestParams);

    const origin = event.headers.origin || event.headers.Origin || '*';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Stream proxy error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
