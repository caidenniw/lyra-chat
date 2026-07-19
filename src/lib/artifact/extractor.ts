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
 * Prepare HTML for iframe preview using Blob URLs.
 * This function replaces relative file paths in the HTML with their corresponding Blob URLs.
 * It also injects the error catcher so we still get UI badges for JS errors.
 */
export function buildPreviewHtmlWithBlobs(files: ArtifactFile[], urlMap: Record<string, string>): string {
  let html = files.find(f => f.path === 'index.html')?.content || '';

  if (!html) {
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

  // ── Replace file paths with Blob URLs ──
  // Sort keys by length descending so longer paths (e.g., 'js/script.js') are replaced before shorter ones ('script.js')
  const paths = Object.keys(urlMap).sort((a, b) => b.length - a.length);
  
  for (const path of paths) {
    const blobUrl = urlMap[path];
    const filename = path.split('/').pop() || path;
    const escapedPath = path.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const escapedFilename = filename.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    // Regex to match href or src containing the path or just the filename, ignoring leading ./
    const regex = new RegExp(`(href|src)=["'](?:\\./)?(${escapedPath}|${escapedFilename})["']`, 'gi');
    html = html.replace(regex, `$1="${blobUrl}"`);
  }

  // ── Inject error catcher wrapper ──
  // Inject a global error handler BEFORE all scripts
  // This catches runtime errors and shows a badge in the preview
  const errorCatcherScript = `<script>
// --- Lyra Error Catcher ---
window.__LYRA_ERROR_CATCHER__ = true;
window.addEventListener('error', function(e) {
  console.error('[Lyra Error]', e.error ? e.error.message : e.message);
  var msg = (e.error ? e.error.message : e.message) || 'Unknown error';
  var badge = document.getElementById('lyra-error-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'lyra-error-badge';
    badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:#ef4444;color:white;font:11px/1.4 system-ui,sans-serif;padding:6px 10px;border-radius:6px;z-index:99999;max-width:80%;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:opacity 0.3s;';
    document.body.appendChild(badge);
  }
  var count = parseInt(badge.dataset.count || '0') + 1;
  badge.dataset.count = count;
  badge.textContent = '\\u26A0\\uFE0F ' + count + ': ' + msg;
  setTimeout(function() { if (badge) badge.style.opacity = '0.5'; }, 8000);
  // Notify parent window if embedded
  try { window.parent.postMessage({ type: 'lyra-error', message: msg, count: count }, '*'); } catch(e) {}
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('[Lyra Error] Unhandled Promise:', e.reason);
  var msg = (e.reason && e.reason.message) || String(e.reason) || 'Promise rejection';
  var badge = document.getElementById('lyra-error-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'lyra-error-badge';
    badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:#ef4444;color:white;font:11px/1.4 system-ui,sans-serif;padding:6px 10px;border-radius:6px;z-index:99999;max-width:80%;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:opacity 0.3s;';
    document.body.appendChild(badge);
  }
  var count = parseInt(badge.dataset.count || '0') + 1;
  badge.dataset.count = count;
  badge.textContent = '\\u26A0\\uFE0F ' + count + ': ' + msg;
  try { window.parent.postMessage({ type: 'lyra-error', message: msg, count: count }, '*'); } catch(e) {}
});
// --- End Error Catcher ---
</script>`;

  // Inject before </head> (for CSS) and before </body> (for scripts)
  // Inject error catcher right after <head> or <body> so it catches everything
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>\n' + errorCatcherScript);
  } else {
    html = html.replace('<body>', '<body>\n' + errorCatcherScript);
  }

  // Also detect common CSS issues: show red outline on elements blocked by pointer-events
  const cssCheckStyle = `<style>
/* Lyra CSS Check - highlight elements blocked by pointer-events:none */
[style*="pointer-events: none"] button,
[style*="pointer-events: none"] a,
[style*="pointer-events: none"] [onclick],
[style*="pointer-events: none"] [role="button"] {
  outline: 3px solid #ef4444 !important;
  outline-offset: 2px !important;
}
[style*="pointer-events: none"] button::after,
[style*="pointer-events: none"] a::after {
  content: " BLOCKED by pointer-events:none on parent!" !important;
  position: absolute !important;
  bottom: 100% !important;
  left: 0 !important;
  background: #ef4444 !important;
  color: white !important;
  font: 10px/1.2 sans-serif !important;
  padding: 2px 6px !important;
  border-radius: 4px !important;
  white-space: nowrap !important;
  z-index: 99999 !important;
}
</style>`;
  if (html.includes('</head>')) {
    html = html.replace('</head>', cssCheckStyle + '\n</head>');
  }

  return html;
}
