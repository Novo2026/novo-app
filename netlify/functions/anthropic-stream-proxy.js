const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const DAILY_MESSAGE_LIMIT = 100;
const LIMIT_EXCEEDED_MESSAGE =
  "You've reached today's chat limit — it resets tomorrow. For urgent questions, contact your loan officer directly.";

const ALLOWED_ORIGINS = [
  'https://novo.windmillmortgage.com',
  'https://windmill-novo.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://txxgvxuuoftqmlrwtplm.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGd2eHV1b2Z0cW1scnd0cGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTA5NzksImV4cCI6MjA5NDM2Njk3OX0.aRKrphpZRuH607FmBFGctWgBET7n5Iix-oCv7iOO1S0';

function corsHeaders(origin) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: corsHeaders(origin),
    body: JSON.stringify(body),
  };
}

exports.handler = async function (event) {
  const origin = event.headers.origin || event.headers.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(origin || '*'),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, origin);
  }

  // Same origin allowlist pattern as anthropic-proxy.js
  if (origin && !ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
    return jsonResponse(403, { error: 'Forbidden' }, origin);
  }

  try {
    const authHeader =
      event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse(
        401,
        {
          error: 'unauthorized',
          message: 'Please sign in to use Ask NOVO.',
        },
        origin
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return jsonResponse(
        401,
        {
          error: 'unauthorized',
          message: 'Please sign in to use Ask NOVO.',
        },
        origin
      );
    }

    const { data: usage, error: usageError } = await supabase.rpc(
      'try_consume_novo_chat_message',
      { p_daily_limit: DAILY_MESSAGE_LIMIT }
    );

    if (usageError) {
      console.error('Chat usage RPC error:', usageError);
      return jsonResponse(
        500,
        { error: 'usage_check_failed', message: 'Unable to verify chat usage. Please try again.' },
        origin
      );
    }

    if (!usage?.ok) {
      if (usage?.error === 'limit_exceeded') {
        return jsonResponse(
          429,
          {
            error: 'rate_limit',
            message: LIMIT_EXCEEDED_MESSAGE,
            count: usage.count,
            limit: usage.limit ?? DAILY_MESSAGE_LIMIT,
          },
          origin
        );
      }
      return jsonResponse(
        401,
        {
          error: 'unauthorized',
          message: 'Please sign in to use Ask NOVO.',
        },
        origin
      );
    }

    const body = JSON.parse(event.body || '{}');
    const { model, max_tokens, messages, system } = body;

    if (!messages || !Array.isArray(messages)) {
      return jsonResponse(400, { error: 'Invalid request' }, origin);
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const requestParams = {
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(max_tokens || 1000, 4096),
      messages,
    };

    if (system) requestParams.system = system;

    const response = await client.messages.create(requestParams);

    return {
      statusCode: 200,
      headers: corsHeaders(origin),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Stream proxy error:', error);
    return jsonResponse(
      500,
      { error: 'API request failed', message: error.message },
      origin
    );
  }
};
