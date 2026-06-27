# Security Audit Report — Lyra Chat (caai-chat)

**Date:** June 27, 2026  
**Scope:** Full codebase security review  
**Severity Levels:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

The Lyra Chat application has several significant security vulnerabilities, primarily around API security. The most critical issues are: **no authentication on the API endpoint**, **wildcard CORS**, and **no rate limiting**, which together allow any website to abuse the API without restriction. On the positive side, no hardcoded secrets were found, the `.env` file is properly gitignored, and the Markdown renderer uses React's safe rendering model for most content.

**Total Findings:** 16  
**Critical:** 1 | **High:** 3 | **Medium:** 7 | **Low:** 3 | **Info:** 2

---

## 1. API Security — api/chat.ts

### FINDING-01: No Authentication on API Endpoint [CRITICAL]

**Location:** `api/chat.ts` (entire file)  
**Issue:** The API endpoint accepts requests from any client without any authentication. There is no JWT verification, session validation, or API key requirement.

```typescript
// Line 9-16: Only checks HTTP method, not authentication
export default async function handler(req: Request) {
  if (req.method !== 'POST') { ... }
  // No auth check here!
```

**Impact:** Any person or website can directly call the API, bypassing the frontend entirely. Combined with the wildcard CORS (FINDING-02), this means any website can make unlimited requests to the OpenCode Zen API through your proxy.

**Recommendation:**
- Verify the Supabase JWT token from the `Authorization` header before processing requests
- Use `supabase.auth.getUser(token)` server-side to validate the session
- Reject unauthenticated requests with 401

---

### FINDING-02: Wildcard CORS [HIGH]

**Location:** `api/chat.ts` line 57, `dev-proxy.js` lines 9, 50, 55  
**Issue:** `Access-Control-Allow-Origin: *` allows any website to make cross-origin requests.

```typescript
// api/chat.ts line 57
'Access-Control-Allow-Origin': '*',
```

**Impact:** Any website can embed your API and make requests on behalf of users. An attacker could create a phishing page that silently uses your API proxy.

**Recommendation:**
- Replace `*` with your production domain (e.g., `https://lyra.yourdomain.com`)
- Add CORS preflight handling for non-simple requests
- Use environment variable for allowed origin

---

### FINDING-03: No Rate Limiting [HIGH]

**Location:** `api/chat.ts` (entire file)  
**Issue:** There is no rate limiting at the API level. No IP-based throttling, request counting, or quotas.

**Impact:** The API can be abused for unlimited requests, leading to:
- Excessive costs from OpenCode Zen API calls
- Denial-of-service against the upstream API
- Abuse by automated scripts

**Recommendation:**
- Implement rate limiting using Vercel Edge Middleware or a rate-limiting library
- Consider per-IP and per-user quotas
- Use Vercel's built-in rate limiting if deploying there

---

### FINDING-04: Insufficient Input Validation [MEDIUM]

**Location:** `api/chat.ts` lines 20-27  
**Issue:** Only validates that `messages` is an array. No validation on:
- Message content length (potential DoS)
- Message role values (could send arbitrary roles)
- Model parameter (any string accepted, could access unintended models)
- `max_tokens` bounds (could request extremely large responses)

```typescript
// Only checks array type
if (!messages || !Array.isArray(messages)) { ... }
// model and max_tokens accepted without validation
const { messages, model = 'deepseek-v4-flash-free', max_tokens = 4096 } = body;
```

**Impact:** Large payloads could cause excessive memory usage. Invalid model strings could cause unexpected behavior upstream.

**Recommendation:**
- Validate message count (max ~50 messages)
- Validate individual message content length (e.g., 32K chars max)
- Whitelist allowed model values
- Clamp `max_tokens` to reasonable range (1-8192)

---

### FINDING-05: Upstream Error Details Leaked to Client [LOW]

**Location:** `api/chat.ts` line 45  
**Issue:** Upstream API error text is forwarded to the client.

```typescript
return new Response(JSON.stringify({ 
  error: `API error: ${response.status}`, 
  details: errorText  // <-- Leaks upstream error details
}), { ... });
```

**Impact:** Could reveal internal API configuration, endpoint structure, or error patterns to attackers.

**Recommendation:**
- Log full errors server-side
- Return generic error messages to clients

---

## 2. Environment Variable Exposure

### FINDING-06: .env Properly Gitignored [INFO — GOOD]

**Location:** `.gitignore`, `.env`  
**Status:** The `.env` file is listed in `.gitignore` and confirmed NOT tracked in git (`git ls-files --cached .env` returned empty).

**Note:** The `VITE_SUPABASE_ANON_KEY` is intentionally exposed to the client (Supabase design pattern). Security relies entirely on Supabase Row Level Security (RLS) policies being correctly configured.

**Recommendation:**
- Verify RLS policies are enabled on all Supabase tables
- Ensure no `service_role` key is ever exposed to the client

---

## 3. XSS Risks

### FINDING-07: dangerouslySetInnerHTML in CodeBlock.tsx [HIGH]

**Location:** `src/components/chat/CodeBlock.tsx` line 130  
**Issue:** highlight.js output is injected as raw HTML via `dangerouslySetInnerHTML`.

```tsx
<code
  className="font-mono text-slate-300"
  dangerouslySetInnerHTML={{ __html: highlighted }}
/>
```

**Impact:** If highlight.js has any HTML injection vulnerability or if the fallback path (lines 77-80) is bypassed, malicious HTML/JavaScript could execute. The fallback path does properly escape `&`, `<`, `>`.

**Note:** highlight.js generally escapes HTML in its output. However, this is still a risk vector.

**Recommendation:**
- Add DOMPurify sanitization before injecting highlighted HTML
- Or use a safer alternative like `react-syntax-highlighter` which doesn't use dangerouslySetInnerHTML

---

### FINDING-08: No HTML Sanitization Library [MEDIUM]

**Location:** `src/components/chat/MarkdownRenderer.tsx` (entire file)  
**Issue:** The markdown renderer is a custom implementation that does not use DOMPurify or any HTML sanitization library.

**Mitigating Factors:**
- React's JSX rendering auto-escapes text content (prevents most XSS)
- The `renderInline` function uses React elements, not raw HTML
- Links use `target="_blank" rel="noopener noreferrer"` (prevents tab-nabbing)

**Risk:** If any code path allows raw HTML injection, XSS is possible.

**Recommendation:**
- Add DOMPurify as a dependency
- Sanitize any HTML content before rendering
- Consider using a battle-tested markdown library like `react-markdown` with `rehype-sanitize`

---

### FINDING-09: User File Content Rendered Without Sanitization [MEDIUM]

**Location:** `src/hooks/useChat.ts` lines 304-311  
**Issue:** File contents are included directly in API messages without sanitization.

```typescript
const fileContent = textFiles
  .map(f => `[File: ${f.name}]\n${f.content}`)
  .join('\n\n');
```

**Impact:** File content could contain prompt injection payloads that manipulate the LLM's behavior.

**Recommendation:**
- Sanitize file content before including in messages
- Consider wrapping file content in special delimiters
- Add metadata about file origin for the LLM to be aware of

---

## 4. Authentication Security

### FINDING-10: No Auth Guard on Protected Routes [MEDIUM]

**Location:** `src/components/layout/AppShell.tsx`, `src/services/chat.ts`  
**Issue:** The app works in "guest mode" without authentication. Database operations in `chat.ts` are guarded by `if (!supabase) return []` but not by user authentication.

**Impact:** In guest mode, there's no user tracking, no rate limiting, and no accountability.

**Recommendation:**
- Consider requiring authentication for API access
- Add guest mode rate limiting
- Track anonymous usage for abuse prevention

---

### FINDING-11: Supabase Auth Configuration [INFO]

**Location:** `supabase/config.toml`  
**Status:** Auth configuration is reasonable:
- Email OTP rate limited to 2/hour (line 199)
- Sign-in rate limited to 30/5min (line 207)
- Refresh token rotation enabled (line 171)
- JWT expiry: 1 hour (line 165)

**Concerns:**
- `enable_confirmations = false` (line 226) — Users don't need to confirm email
- `secure_password_change = false` (line 228) — No re-auth for password changes
- `minimum_password_length = 6` (line 182) — Consider increasing to 8+

---

## 5. File Upload Security

### FINDING-12: Client-Side Only File Validation [MEDIUM]

**Location:** `src/components/chat/InputArea.tsx` lines 21, 93-163  
**Issue:** File type checking is done client-side only using file extension and MIME type.

```typescript
function isPdfFile(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");  // Extension check only
}
```

**Impact:** An attacker could rename a malicious file to bypass type checks. However, since files are processed client-side (PDF.js, mammoth), the risk is limited to the user's own browser.

**Mitigating Factors:**
- Files are processed in the browser (not uploaded to a server)
- Processing libraries (PDF.js, mammoth) have their own security measures

**Recommendation:**
- This is acceptable for client-side processing
- If server-side processing is added later, add MIME type verification

---

### FINDING-13: Large File DoS Risk [LOW]

**Location:** `src/components/chat/InputArea.tsx` line 21  
**Issue:** While there's a 15MB file size limit, there's no limit on the number of files that can be processed sequentially.

```typescript
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_FILES = 8;
```

**Mitigating Factors:**
- MAX_FILES = 8 limits total files
- MAX_CONTENT_CHARS = 120,000 limits extracted text

**Status:** Acceptable with current limits.

---

## 6. Hardcoded Secrets

### FINDING-14: No Hardcoded Secrets Found [INFO — GOOD]

**Status:** No API keys, passwords, tokens, or other secrets were found hardcoded in the source code.

- All sensitive values use environment variables
- Supabase config uses `env()` function references
- No `sk-`, `api_key`, `secret`, `password`, `token`, or `bearer` patterns found in source files

---

## 7. Additional Security Concerns

### FINDING-15: Missing Security Headers [MEDIUM]

**Issue:** No security headers configured:
- No Content-Security-Policy (CSP)
- No X-Frame-Options (clickjacking protection)
- No X-Content-Type-Options (MIME sniffing protection)
- No Referrer-Policy

**Recommendation:** Add security headers in `vercel.json` or via middleware:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

---

### FINDING-16: Model Parameter Not Validated [LOW]

**Location:** `api/chat.ts` line 20  
**Issue:** The `model` parameter is accepted without validation.

```typescript
const { messages, model = 'deepseek-v4-flash-free', max_tokens = 4096 } = body;
```

**Impact:** Could be used to access models not intended for public use.

**Recommendation:** Whitelist allowed models:
```typescript
const ALLOWED_MODELS = ['deepseek-v4-flash-free', 'mimo-v2.5-free', 'nemotron-3-ultra-free'];
if (!ALLOWED_MODELS.includes(model)) {
  return new Response(JSON.stringify({ error: 'Invalid model' }), { status: 400 });
}
```

---

## Priority Remediation Plan

### Immediate (Critical/High) — Do Before Production
1. **Add JWT authentication to api/chat.ts** (FINDING-01)
2. **Replace wildcard CORS with specific origin** (FINDING-02)
3. **Implement rate limiting** (FINDING-03)
4. **Add DOMPurify for CodeBlock.tsx** (FINDING-07)

### Short-term (Medium) — Within 1-2 Weeks
5. Add input validation to API (FINDING-04)
6. Add security headers (FINDING-15)
7. Consider requiring auth for API access (FINDING-10)
8. Add DOMPurify to markdown renderer (FINDING-08)

### Long-term (Low/Info) — Nice to Have
9. Sanitize file content before LLM (FINDING-09)
10. Validate model parameter (FINDING-16)
11. Suppress upstream error details (FINDING-05)

---

## Files Audited

| File | Findings |
|------|----------|
| `api/chat.ts` | FINDING-01, 02, 03, 04, 05, 16 |
| `dev-proxy.js` | FINDING-02 |
| `src/lib/supabase.ts` | FINDING-06 |
| `src/contexts/AuthContext.tsx` | FINDING-10, 11 |
| `src/components/chat/MarkdownRenderer.tsx` | FINDING-08 |
| `src/components/chat/CodeBlock.tsx` | FINDING-07 |
| `src/components/chat/InputArea.tsx` | FINDING-12, 13 |
| `src/hooks/useChat.ts` | FINDING-09 |
| `src/services/chat.ts` | FINDING-10 |
| `src/lib/ai/streamWorker.ts` | FINDING-05 |
| `supabase/config.toml` | FINDING-11 |
| `.env` | FINDING-06 |
| `.gitignore` | FINDING-06 |
| `vercel.json` | FINDING-15 |

---

*Report generated by Hermes Agent security audit*
