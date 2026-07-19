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

  // 5. Combine all JS
  let combinedJs = "";
  for (const js of jsFiles) {
    combinedJs += `\n// === ${js.path} ===\n${js.content}\n`;
  }

  // 6. Error catcher script
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
  window.addEventListener('error', function(e) {
    var msg = (e.error && e.error.message) || e.message || 'Unknown error';
    showError(msg);
  });
  window.addEventListener('unhandledrejection', function(e) {
    var msg = (e.reason && e.reason.message) || String(e.reason) || 'Promise rejected';
    showError(msg);
  });
})();
// --- End Error Catcher ---
`;

  // 7. SPA Router for multi-page navigation
  const spaRouter = hasMultiplePages ? `
// --- Lyra SPA Router ---
(function() {
  var pages = ${JSON.stringify(htmlFiles.map(f => ({ path: f.path, content: f.content })))};
  
  window.__LYRA_PAGES__ = pages;
  
  // Intercept all link clicks
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
    
    // Normalize: remove leading ./
    var target = href.replace(/^\\.\\//, '');
    
    // Check if target page exists
    var page = pages.find(function(p) { return p.path === target || p.path.endsWith('/' + target); });
    if (page) {
      e.preventDefault();
      window.__LYRA_NAVIGATE__(target);
    }
  });
  
  window.__LYRA_NAVIGATE__ = function(target) {
    var page = pages.find(function(p) { return p.path === target || p.path.endsWith('/' + target); });
    if (!page) return;
    
    // Replace entire document
    var newHtml = page.content;
    
    // Extract CSS and JS from new page and inline them
    var css = ${JSON.stringify(combinedCss)};
    var js = ${JSON.stringify(combinedJs)};
    
    // Remove external links/scripts from new page
    newHtml = newHtml.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
    newHtml = newHtml.replace(/<script[^>]*src=["'][^"']*["'][^>]*>\\s*<\\/script>/gi, '');
    
    // Inject CSS before </head>
    if (newHtml.indexOf('</head>') !== -1) {
      newHtml = newHtml.replace('</head>', '<style>' + css + '</style></head>');
    }
    
    // Inject JS + router before </body>
    var routerScript = document.currentScript ? document.currentScript.textContent : '';
    if (newHtml.indexOf('</body>') !== -1) {
      newHtml = newHtml.replace('</body>', '<script>' + js + '\\n' + errorCatcherScript + '\\n' + routerScript + '</script></body>');
    }
    
    document.open();
    document.write(newHtml);
    document.close();
    
    // Notify parent
    try { window.parent.postMessage({ type: 'lyra-navigate', path: target }, '*'); } catch(e) {}
  };
})();
// --- End SPA Router ---
` : "";

  // 8. Inject CSS before </head>
  if (html.includes("</head>")) {
    html = html.replace("</head>", `<style>${combinedCss}</style>\n</head>`);
  } else {
    html = `<style>${combinedCss}</style>\n` + html;
  }

  // 9. Inject JS (error catcher + spa router + all JS) before </body>
  const fullJs = `<script>\n${errorCatcher}\n${spaRouter}\n${combinedJs}\n</script>`;
  if (html.includes("</body>")) {
    html = html.replace("</body>", `${fullJs}\n</body>`);
  } else {
    html = html + "\n" + fullJs;
  }

  return html;
}