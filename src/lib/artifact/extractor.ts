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
 * Click interceptor script — injected into ALL preview HTML to prevent navigation.
 */
export const INTERCEPT_SCRIPT = `<script>
(function() {
  // 1. Block ALL link clicks — only allow anchor (#) links
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (href && href.startsWith('#')) return;
    if (href && href.startsWith('javascript:')) return;
    e.preventDefault();
    e.stopPropagation();
    if (link.onclick) link.onclick.call(link, e);
    console.log('[Lyra Preview] Blocked link:', href);
  }, true);

  // 2. Block ALL form submissions
  document.addEventListener('submit', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Lyra Preview] Blocked form submit');
  }, true);

  // 3. Block window.location navigation attempts
  var blocked = false;
  function blockNavigation(url) {
    if (blocked) return;
    blocked = true;
    console.log('[Lyra Preview] Blocked navigation to:', url);
    setTimeout(function() { blocked = false; }, 100);
  }

  // Block location.assign and location.replace
  var origAssign = location.assign.bind(location);
  var origReplace = location.replace.bind(location);
  location.assign = function(url) { blockNavigation(url); };
  location.replace = function(url) { blockNavigation(url); };

  // Block window.location = "url" and location.href = "url"
  try {
    Object.defineProperty(window, 'location', {
      configurable: false,
      enumerable: true,
      value: new Proxy(window.location, {
        set: function(target, prop, value) {
          if (prop === 'href' || prop === 'pathname') {
            blockNavigation(value);
            return true;
          }
          target[prop] = value;
          return true;
        },
        get: function(target, prop) {
          if (prop === 'assign') return function(url) { blockNavigation(url); };
          if (prop === 'replace') return function(url) { blockNavigation(url); };
          return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
        }
      })
    });
  } catch(e) { /* proxy not supported, fallback */ }

  // 4. Block window.open
  var origOpen = window.open;
  window.open = function(url) { blockNavigation(url); return null; };

  // 5. Block history navigation
  history.pushState = function() { console.log('[Lyra Preview] Blocked pushState'); };
  history.replaceState = function() { console.log('[Lyra Preview] Blocked replaceState'); };
})();
</script>`;

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

  // Inject CSS files inline
  const cssFiles = files.filter(f => f.path.endsWith('.css'));
  for (const css of cssFiles) {
    html = html.replace(
      `<link rel="stylesheet" href="${css.path}">`,
      `<style>\n${css.content}\n</style>`
    );
    const filename = css.path.split('/').pop() || css.path;
    html = html.replace(
      new RegExp(`<link[^>]*href=["'][^"']*${filename.replace('.', '\\.')}["'][^>]*>`, 'gi'),
      `<style>\n${css.content}\n</style>`
    );
  }

  // Inject JS files inline
  const jsFiles = files.filter(f => f.path.endsWith('.js'));
  for (const js of jsFiles) {
    const filename = js.path.split('/').pop() || js.path;
    html = html.replace(
      new RegExp(`<script[^>]*src=["'][^"']*${filename.replace('.', '\\.')}["'][^>]*>\\s*</script>`, 'gi'),
      `<script>\n${js.content}\n</script>`
    );
  }

  return html;
}
