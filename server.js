// server.js — Production server for Railway deployment
import express from 'express';
import https from 'https';
import { URL } from 'url';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ── AI Provider Config (from environment) ──────────────────────────
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://opencode.ai/zen/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';
// Merge env models with hardcoded defaults so new models still work
// even if Railway env var hasn't been updated yet
const HARDCODED_MODELS = ['ling-3.0-flash-free', 'deepseek-v4-flash-free', 'mimo-v2.5-free', 'nemotron-3-ultra-free'];
const ENV_MODELS = (process.env.AI_ALLOWED_MODELS || '').split(',').map(m => m.trim()).filter(Boolean);
const ALLOWED_MODELS = [...new Set([...ENV_MODELS, ...HARDCODED_MODELS])];
const MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '32768', 10);

// Parse base URL into hostname + path
const aiUrl = new URL(AI_BASE_URL);
const AI_HOSTNAME = aiUrl.hostname;
const AI_PATH = aiUrl.pathname;

const MAX_MESSAGES = 150;
const MAX_MESSAGE_LENGTH = 200000;

// Simple rate limit
const rateLimitMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Parse JSON body with higher limit for images/files
app.use(express.json({ limit: '20mb' }));

// Health check — Railway needs a quick 200 on /health or similar
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API endpoint
app.post('/api/chat', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

  // Rate limit
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please wait.' });
  }

  try {
    const { messages, model = 'deepseek-v4-flash-free', max_tokens = 4096 } = req.body;

    // Validate
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({ error: `Too many messages (max ${MAX_MESSAGES})` });
    }
    if (!ALLOWED_MODELS.includes(model)) {
      return res.status(400).json({ error: `Invalid model: ${model}` });
    }
    const safeMaxTokens = Math.min(Math.max(1, max_tokens), MAX_TOKENS);

    // Call AI provider
    const postData = JSON.stringify({
      model,
      messages,
      max_tokens: safeMaxTokens,
      stream: true,
    });

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'text/event-stream',
    };

    // Add API key if configured (paid tier / non-free endpoint)
    if (AI_API_KEY) {
      headers['Authorization'] = `Bearer ${AI_API_KEY}`;
    }

    const options = {
      hostname: AI_HOSTNAME,
      port: 443,
      path: AI_PATH,
      method: 'POST',
      headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      const statusCode = proxyRes.statusCode || 200;
      const contentType = proxyRes.headers['content-type'] || '';

      if (statusCode >= 400) {
        let errorBody = '';
        proxyRes.on('data', chunk => { errorBody += chunk; });
        proxyRes.on('end', () => {
          console.error('[Server] Upstream error:', statusCode, errorBody.slice(0, 500));
          res.status(502).json({ error: 'AI service temporarily unavailable' });
        });
        return;
      }

      // SSE streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      proxyRes.on('data', (chunk) => {
        const canContinue = res.write(chunk);
        if (!canContinue) {
          proxyRes.pause();
          res.once('drain', () => proxyRes.resume());
        }
      });

      proxyRes.on('end', () => {
        res.end();
      });

      proxyRes.on('error', (err) => {
        console.error('[Server] Upstream error:', err.message);
        if (!res.writableEnded) res.end();
      });
    });

    proxyReq.on('error', (error) => {
      console.error('[Server] Request error:', error.message);
      console.error('[Server] Target:', AI_HOSTNAME, AI_PATH);
      if (!res.headersSent) {
        res.status(502).json({ error: 'AI service unavailable' });
      }
    });

    proxyReq.write(postData);
    proxyReq.end();

  } catch (error) {
    console.error('[Server] Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static frontend — disable index so root route can serve landing page
app.use(express.static(join(__dirname, 'dist'), { index: false }));
// Serve landing page from public directory
app.use('/landing', express.static(join(__dirname, 'public/landing')));

// Root route → landing page (like openai.com / claude.ai)
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'landing', 'index.html'));
});

// Privacy policy — static page linked from landing footer
app.get('/privacy', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'landing', 'privacy.html'));
});

// SPA — /chat and any subpath serve the app (Express 5 *splat needs ≥1 segment,
// so bare /chat must be its own route)
app.get('/chat', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});
app.get('/chat/*splat', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Lyra Chat server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`AI Base URL: ${AI_BASE_URL}`);
  console.log(`AI Provider: ${AI_HOSTNAME}${AI_PATH}`);
  console.log(`AI API Key: ${AI_API_KEY ? 'SET (' + AI_API_KEY.slice(0,8) + '...)' : 'EMPTY'}`);
  console.log(`Allowed models: ${ALLOWED_MODELS.join(', ')}`);
});

// Set a high timeout (10 minutes) so long-running reasoning models don't get cut off,
// but DO NOT set it to 0, as 0 breaks Railway's TCP Healthcheck keep-alive mechanism.
server.timeout = 600000;
server.keepAliveTimeout = 610000;
server.headersTimeout = 620000;
