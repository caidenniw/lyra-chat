// server.js — Production server for Railway deployment
import express from 'express';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security config
const ALLOWED_MODELS = [
  'deepseek-v4-flash-free',
  'mimo-v2.5-free',
  'nemotron-3-ultra-free',
];

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 50000;
const MAX_TOKENS = 32768;

// Simple rate limit
const rateLimitMap = new Map();
const RATE_LIMIT = 30;
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

// Parse JSON body
app.use(express.json({ limit: '1mb' }));

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

    // Call OpenCode Zen API
    const postData = JSON.stringify({
      model,
      messages,
      max_tokens: safeMaxTokens,
      stream: true,
    });

    const options = {
      hostname: 'opencode.ai',
      port: 443,
      path: '/zen/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'text/event-stream',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      const statusCode = proxyRes.statusCode || 200;
      const contentType = proxyRes.headers['content-type'] || '';

      if (statusCode >= 400) {
        let errorBody = '';
        proxyRes.on('data', chunk => { errorBody += chunk; });
        proxyRes.on('end', () => {
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

// Serve static frontend
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Lyra Chat server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
