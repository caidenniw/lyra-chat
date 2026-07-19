// src/lib/artifact/preview.ts
// Membangun HTML untuk iframe preview dengan inline injection + custom multi-page router

import type { ArtifactFile } from "./extractor";

/**
 * Build a complete HTML document for iframe srcdoc preview.
 * - Inline all CSS before </head>
 * - Inline all JS + error catcher + SPA router before </body>
 * - Intercept <a href="*.html"> clicks for multi-page navigation
 */
export function buildPreviewHtml(files: ArtifactFile[]): string {
  const htmlFiles = files.filter(f => f.path.endsWith(".html"));
  const cssFiles = files.filter(f => f.path.endsWith(".css"));
  const jsFiles = files.filter(f => f.path.endsWith(".js"));
  const hasMultiplePages = htmlFiles.length > 1;

  // 1. Find index.html or first HTML file
  let html = htmlFiles.find(f => f.path === "index.html")?.content ||
             htmlFiles.find(f => f.path.endsWith(".html"))?.content ||
             files[0]?.content || "";

  // 2. Ensure it's a full HTML document
  const trimmed = html.trim().toLowerCase();
  if (!trimmed.startsWith("<!doctype") && !trimmed.startsWith("<html")) {
    html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${html}
</body>
</html>`;
  }

  // 3. Remove external <link> and <script src> to avoid 404s
  html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, "");
  html = html.replace(/<script[^>]*src=["'][^"']*["'][^>]*>\s*<\/script>/gi, "");

  // 4. Combine all CSS
  let combinedCss = "";
  for (const css of cssFiles) {
    combinedCss += `\n/* === ${css.path} === */\n${css.content}\n`;
  }

  // 5. Combine all JS, wrapped in try-catch per file so one error doesn't kill everything
  let combinedJs = "";
  for (const js of jsFiles) {
    combinedJs += `\n// === ${js.path} ===\ntry {\n${js.content}\n} catch(e) { console.error("Error in ${js.path}:", e); showError("Error in ${js.path}: " + e.message); }\n`;
  }

  // 6. Error catcher + DOMContentLoaded polyfill
  const errorCatcher = `
// --- Lyra Error Catcher ---
(function() {
  function showError(msg) {
    var badge = document.getElementById('lyra-err');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'lyra-err';
      badge.style.cssText = 'position:fixed;bottom:8px;right:8px;background:#ef4444;color:#fff;font:11px/1.4 system-ui,sans-serif;padding:6px 10px;border-radius:6px;z-index:99999;max-width:80%;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
      document.body.appendChild(badge);
    }
    var count = parseInt(badge.dataset.c || '0') + 1;
    badge.dataset.c = count;
    badge.textContent = '\\u26A0 ' + count + ': ' + msg;
    try { window.parent.postMessage({ type: 'lyra-error', message: msg, count: count }, '*'); } catch(e) {}
  }
  window.__LYRA_SHOW_ERROR__ = showError;
  window.addEventListener('error', function(e) {
    var msg = (e.error && e.error.message) || e.message || 'Unknown error';
    showError(msg);
  });
  window.addEventListener('unhandledrejection', function(e) {
    var msg = (e.reason && e.reason.message) || String(e.reason) || 'Promise rejected';
    showError(msg);
  });
  
  // DOMContentLoaded polyfill: catch listeners registered after event already fired
  var origAddEventListener = document.addEventListener.bind(document);
  document.addEventListener = function(type, fn, opts) {
    if (type === 'DOMContentLoaded' && document.readyState !== 'loading') {
      try { fn(); } catch(e) { showError('DOMContentLoaded: ' + e.message); }
      return;
    }
    if (type === 'load' && document.readyState === 'complete') {
      try { fn(); } catch(e) { showError('load: ' + e.message); }
      return;
    }
    origAddEventListener(type, fn, opts);
  };
  // Also handle window.onload assignments
  if (typeof Object.defineProperty === 'function') {
    var _onload = window.onload;
    Object.defineProperty(window, 'onload', {
      get: function() { return _onload; },
      set: function(fn) { _onload = fn; if (fn && document.readyState === 'complete') try { fn(); } catch(e) {} }
    });
  }
})();
// --- End Error Catcher ---
`;

  // 7. SPA Router for multi-page navigation
  // All variables MUST be inlined as JSON string literals to avoid runtime "undefined" errors.
  const pagesJson = JSON.stringify(htmlFiles.map(f => ({ path: f.path, content: f.content })));
  const cssJson = JSON.stringify(combinedCss);
  const jsJson = JSON.stringify(combinedJs);
  const errorCatcherJson = JSON.stringify(errorCatcher);

  const spaRouter = hasMultiplePages ? `
// --- Lyra SPA Router ---
(function() {
  var pages = ${pagesJson};
  var sharedCss = ${cssJson};
  var sharedJs = ${jsJson};
  var errorCatcherCode = ${errorCatcherJson};
  
  window.__LYRA_PAGES__ = pages;
  
  function navigateTo(target) {
    var page = pages.find(function(p) { return p.path === target || p.path.endsWith('/' + target); });
    if (!page) return;
    
    var newHtml = page.content;
    
    // Remove external links/scripts
    newHtml = newHtml.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
    newHtml = newHtml.replace(/<script[^>]*src=["'][^"']*["'][^>]*>\\s*<\\/script>/gi, '');
    
    // Inject shared CSS before </head>
    if (newHtml.indexOf('</head>') !== -1) {
      newHtml = newHtml.replace('</head>', '<style>' + sharedCss + '</style></head>');
    }
    
    // Inject shared JS + error catcher + router before </body>
    var routerCode = '(' + navigateTo.toString() + ')'; // self-referencing for re-injection
    var scriptTag = '<script>' + sharedJs + '\\n' + errorCatcherCode + '\\n' + routerCode + '</scr' + 'ipt>';
    if (newHtml.indexOf('</body>') !== -1) {
      newHtml = newHtml.replace('</body>', scriptTag + '</body>');
    }
    
    document.open();
    document.write(newHtml);
    document.close();
    
    try { window.parent.postMessage({ type: 'lyra-navigate', path: target }, '*'); } catch(e) {}
  }
  
  // Intercept all link clicks
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
    var target = href.replace(/^\\.\\//, '');
    var page = pages.find(function(p) { return p.path === target || p.path.endsWith('/' + target); });
    if (page) {
      e.preventDefault();
      navigateTo(target);
    }
  });
  
  window.__LYRA_NAVIGATE__ = navigateTo;
})();
// --- End SPA Router ---
` : "";

  // 8. Inject CSS before </head>
  if (html.includes("</head>")) {
    html = html.replace("</head>", `<style>${combinedCss}</style>\n</head>`);
  } else {
    html = `<style>${combinedCss}</style>\n` + html;
  }

  // 9. Inject JS: error catcher FIRST, then spa router + all combined JS
  // Error catcher MUST come first so try-catch in combinedJs can use showError()
  const fullJs = `<script>\n${errorCatcher}\n${spaRouter}\n${combinedJs}\n</script>`;
  if (html.includes("</body>")) {
    html = html.replace("</body>", `${fullJs}\n</body>`);
  } else {
    html = html + "\n" + fullJs;
  }

  return html;
}