// dev-proxy.js — Local dev proxy server for AI provider SSE streaming
import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3001;

// ── AI Provider Config (from environment, fallback to defaults) ───
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://opencode.ai/zen/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY || '';

const aiUrl = new URL(AI_BASE_URL);
const AI_HOSTNAME = aiUrl.hostname;
const AI_PATH = aiUrl.pathname;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== 'POST' || req.url !== '/api/chat') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const postData = JSON.stringify(parsed);

      // Build headers
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'text/event-stream',
        'Connection': 'keep-alive',
      };

      // Add API key if configured
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
        const contentType = proxyRes.headers['content-type'] || '';
        const statusCode = proxyRes.statusCode || 200;

        if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
          // SSE streaming — send chunks immediately with flush
          res.writeHead(statusCode, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
          });

          proxyRes.on('data', (chunk) => {
            const canContinue = res.write(chunk);
            if (typeof res.flush === 'function') {
              res.flush();
            }
            if (!canContinue) {
              proxyRes.pause();
              res.once('drain', () => proxyRes.resume());
            }
          });

          proxyRes.on('end', () => {
            res.end();
            console.log('[Proxy] SSE stream ended normally');
          });

        } else if (statusCode >= 400) {
          console.error(`[Proxy] Upstream error ${statusCode}`);
          let errorBody = '';
          proxyRes.on('data', chunk => { errorBody += chunk; });
          proxyRes.on('end', () => {
            res.writeHead(statusCode, {
              'Content-Type': contentType || 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(errorBody);
          });

        } else {
          const responseHeaders = {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin': '*',
          };
          res.writeHead(statusCode, responseHeaders);
          proxyRes.pipe(res);
        }

        proxyRes.on('error', (err) => {
          console.error('[Proxy] Upstream response error:', err.message);
          if (!res.writableEnded) res.end();
        });
      });

      proxyReq.on('error', (error) => {
        console.error('[Proxy] Request error:', error.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: error.message }));
        }
      });

      proxyReq.write(postData);
      proxyReq.end();
    } catch (error) {
      console.error('[Proxy] Parse error:', error.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
});

// No timeout — let streams run as long as needed
server.timeout = 0;
server.keepAliveTimeout = 0;

server.listen(PORT, () => {
  console.log(`Dev proxy running on http://localhost:${PORT}`);
  console.log(`Forwarding to ${AI_HOSTNAME}${AI_PATH}`);
  console.log(`API Key: ${AI_API_KEY ? 'configured' : 'not set (free tier)'}`);
  console.log(`No timeout — streams can run as long as needed`);
});
