// src/lib/artifact/extractor.ts — Extract artifact blocks from AI messages

export interface ArtifactFile {
  path: string;
  content: string;
}

export interface ArtifactBlock {
  id: string;
  code: string;
  title?: string;
  files?: ArtifactFile[];
}

const ARTIFACT_START = '<!-- lyra-artifact';
const ARTIFACT_END = '<!-- /lyra-artifact -->';
const FILE_START = '<!-- lyra-file';
const FILE_END = '<!-- /lyra-file -->';

/**
 * Parse multi-file markers within an artifact block.
 * If no lyra-file markers found, treat entire code as single index.html.
 */
function parseFiles(code: string): ArtifactFile[] {
  const files: ArtifactFile[] = [];
  let hasFileMarkers = false;
  let searchFrom = 0;

  while (searchFrom < code.length) {
    const startIdx = code.indexOf(FILE_START, searchFrom);
    if (startIdx === -1) break;

    const startTagEnd = code.indexOf('-->', startIdx);
    if (startTagEnd === -1) break;
    const startTag = code.substring(startIdx, startTagEnd + 3);

    const pathMatch = startTag.match(/path="([^"]*)"/);
    const filePath = pathMatch?.[1] || 'index.html';

    const contentStart = startTagEnd + 3;
    const endIdx = code.indexOf(FILE_END, contentStart);
    if (endIdx === -1) break;

    const fileContent = code.substring(contentStart, endIdx).trim();
    if (fileContent.length > 0) {
      files.push({ path: filePath, content: fileContent });
      hasFileMarkers = true;
    }

    searchFrom = endIdx + FILE_END.length;
  }

  // If no file markers found, treat entire code as single HTML file
  if (!hasFileMarkers) {
    return [{ path: 'index.html', content: code }];
  }

  return files;
}

/**
 * Extract all artifact blocks from a message string.
 */
export function extractArtifacts(content: string): ArtifactBlock[] {
  const artifacts: ArtifactBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const startIdx = content.indexOf(ARTIFACT_START, searchFrom);
    if (startIdx === -1) break;

    const startTagEnd = content.indexOf('-->', startIdx);
    if (startTagEnd === -1) break;
    const startTagFull = content.substring(startIdx, startTagEnd + 3);

    const titleMatch = startTagFull.match(/title="([^"]*)"/);
    const title = titleMatch?.[1] || undefined;

    const codeStart = startTagEnd + 3;
    const endIdx = content.indexOf(ARTIFACT_END, codeStart);
    if (endIdx === -1) break;

    const code = content.substring(codeStart, endIdx).trim();
    if (code.length > 0) {
      const files = parseFiles(code);
      artifacts.push({
        id: `artifact-${artifacts.length}-${Date.now()}`,
        code,
        title,
        files,
      });
    }

    searchFrom = endIdx + ARTIFACT_END.length;
  }

  return artifacts;
}

/**
 * Check if a message contains at least one artifact block (complete).
 */
export function hasArtifact(content: string): boolean {
  return content.includes(ARTIFACT_START) && content.includes(ARTIFACT_END);
}

/**
 * Check if message has a start marker but NO end marker (incomplete/partial artifact).
 */
export function hasPartialArtifact(content: string): boolean {
  return content.includes(ARTIFACT_START) && !content.includes(ARTIFACT_END);
}

/**
 * Remove artifact blocks from message content.
 * Also handles partial artifacts (start marker but no end marker).
 */
export function stripArtifacts(content: string): string {
  let result = content;
  let idx = 0;

  while (true) {
    const startIdx = result.indexOf(ARTIFACT_START, idx);
    if (startIdx === -1) break;

    const endIdx = result.indexOf(ARTIFACT_END, startIdx);
    if (endIdx === -1) {
      // Partial artifact — remove from start marker to end of content
      result = result.substring(0, startIdx);
      break;
    }

    const before = result.substring(0, startIdx);
    const after = result.substring(endIdx + ARTIFACT_END.length);
    result = before + after;
    idx = before.length;
  }

  return result.trim();
}


/**
 * Combine multiple files into a single HTML document for iframe preview.
 * If index.html exists, inject CSS and JS from other files inline.
 */
export function buildPreviewHtml(files: ArtifactFile[]): string {
  let html = files.find(f => f.path === 'index.html')?.content || '';

  if (!html) {
    // If no index.html, take the first HTML file
    const htmlFile = files.find(f => f.path.endsWith('.html'));
    html = htmlFile?.content || files[0]?.content || '';
  }

  // Ensure it's a full HTML document
  if (!html.trim().toLowerCase().startsWith('<!doctype') && !html.trim().toLowerCase().startsWith('<html')) {
    html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body{margin:0;font-family:system-ui,sans-serif;}</style>
</head>
<body>${html}</body>
</html>`;
  }

  // ── Inject CSS files inline ──
  const cssFiles = files.filter(f => f.path.endsWith('.css'));
  for (const css of cssFiles) {
    const filename = css.path.split('/').pop() || css.path;
    const escapedFilename = filename.replace('.', '\\.');

    // Flexible regex: handle ./ prefix, extra attrs, spacing
    const cssRegex = new RegExp(
      '<link[^>]*href=["\']' +
      '(?:[^"\']*?/)?' +       // optional directory path (e.g. css/)
      escapedFilename +
      '["\'][^>]*\\s*/?>' +
      '(?:\\s*</link>)?',
      'gi'
    );

    html = html.replace(cssRegex, `<style>\n${css.content}\n</style>`);
  }

  // ── Inject JS files inline ──
  const jsFiles = files.filter(f => f.path.endsWith('.js'));
  for (const js of jsFiles) {
    const filename = js.path.split('/').pop() || js.path;
    const escapedFilename = filename.replace('.', '\\.');

    // Flexible regex: handle ./ prefix, defer, type="", extra attrs, spacing
    const jsRegex = new RegExp(
      '<script[^>]*src=["\']' +
      '(?:[^"\']*?/)?' +        // optional directory path (e.g. js/)
      escapedFilename +
      '["\'][^>]*>' +
      '\\s*</script>',
      'gi'
    );

    html = html.replace(jsRegex, `<script>\n${js.content}\n</script>`);
  }

  // ── FALLBACK: if any css/js file was NOT injected, append at end of body ──
  // Check if css still has external links
  for (const css of cssFiles) {
    const filename = css.path.split('/').pop() || css.path;
    if (html.includes(filename) && html.includes('<link')) {
      // Still has external CSS reference — append inline style before </head>
      console.warn(`[Artifact] CSS not injected via regex — appending fallback: ${css.path}`);
      html = html.replace('</head>', `<style>\n${css.content}\n</style>\n</head>`);
    }
  }

  // Check if js still has script src (not yet injected)
  for (const js of jsFiles) {
    const filename = js.path.split('/').pop() || js.path;
    if (html.includes(filename) && html.includes('<script') && html.includes('src=')) {
      // Still has external JS reference — append inline script before </body>
      console.warn(`[Artifact] JS not injected via regex — appending fallback: ${js.path}`);
      html = html.replace('</body>', `<script>\n${js.content}\n</script>\n</body>`);
    }
  }

  // ── Inject error catcher wrapper ──
  // Wrap regular scripts with error handling + detect pointer-events issues
  html = html.replace(
    /<script>\n([\s\S]*?)<\/script>/g,
    (match, scriptContent) => {
      // Skip if already wrapped
      if (scriptContent.includes('__LYRA_ERROR_CATCHER__')) return match;

      const wrapped = `\n// --- Lyra Error Catcher ---\nwindow.__LYRA_ERROR_CATCHER__ = true;\nwindow.addEventListener('error', function(e) {\n  console.error('[Lyra Error]', e.error ? e.error.message : e.message);\n  var msg = (e.error ? e.error.message : e.message) || 'Unknown error';\n  // Show badge in iframe\n  var badge = document.getElementById('lyra-error-badge');\n  if (!badge) {\n    badge = document.createElement('div');\n    badge.id = 'lyra-error-badge';\n    badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:#ef4444;color:white;font:11px/1.4 system-ui,sans-serif;padding:6px 10px;border-radius:6px;z-index:99999;max-width:80%;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:opacity 0.3s;';\n    document.body.appendChild(badge);\n  }\n  var count = parseInt(badge.dataset.count || '0') + 1;\n  badge.dataset.count = count;\n  badge.textContent = '\\u26A0\\uFE0F ' + count + ': ' + msg;\n  setTimeout(function() { if (badge) badge.style.opacity = '0.5'; }, 8000);\n  // Notify parent window if embedded\n  try { window.parent.postMessage({ type: 'lyra-error', message: msg, count: count }, '*'); } catch(e) {}\n});\n// Handle unhandled promise rejections too\nwindow.addEventListener('unhandledrejection', function(e) {\n  console.error('[Lyra Error] Unhandled Promise:', e.reason);\n  var msg = (e.reason && e.reason.message) || String(e.reason) || 'Promise rejection';\n  var badge = document.getElementById('lyra-error-badge');\n  if (!badge) {\n    badge = document.createElement('div');\n    badge.id = 'lyra-error-badge';\n    badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:#ef4444;color:white;font:11px/1.4 system-ui,sans-serif;padding:6px 10px;border-radius:6px;z-index:99999;max-width:80%;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:opacity 0.3s;';\n    document.body.appendChild(badge);\n  }\n  var count = parseInt(badge.dataset.count || '0') + 1;\n  badge.dataset.count = count;\n  badge.textContent = '\\u26A0\\uFE0F ' + count + ': ' + msg;\n  try { window.parent.postMessage({ type: 'lyra-error', message: msg, count: count }, '*'); } catch(e) {}\n});\n// --- End Error Catcher ---\n\n${scriptContent}`;

      return `<script>${wrapped}</script>`;
    }
  );

  // Also detect common CSS issues
  const cssWarning = `\n/* Lyra CSS Check */\n@media (scripting: enabled) {\n  /* Warn if pointer-events:none blocks clicks */\n  [style*="pointer-events: none"] button,\n  [style*="pointer-events: none"] a,\n  [style*="pointer-events: none"] .btn,\n  [style*="pointer-events: none"] [onclick],\n  [style*="pointer-events: none"] [role="button"] {\n    outline: 3px solid #ef4444 !important;\n    outline-offset: 2px !important;\n    position: relative !important;\n  }\n  [style*="pointer-events: none"] button::after,\n  [style*="pointer-events: none"] a::after,\n  [style*="pointer-events: none"] .btn::after {\n    content: \" BLOCKED by pointer-events:none on parent!\" !important;\n    position: absolute !important;\n    bottom: 100% !important;\n    left: 0 !important;\n    background: #ef4444 !important;\n    color: white !important;\n    font: 10px/1.2 system-ui,sans-serif !important;\n    padding: 2px 6px !important;\n    border-radius: 4px !important;\n    white-space: nowrap !important;\n    z-index: 99999 !important;\n  }\n}\n`;

  html = html.replace('</head>', `<style>${cssWarning}\n</style>\n</head>`);

  return html;
}
