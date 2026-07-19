// src/lib/artifact/preview.ts — Build sandboxed preview pages from artifact files
// Uses DOMParser (not regex) to inline CSS/JS and wire up multi-page navigation
// and runtime error capture via postMessage.

import type { ArtifactFile } from './extractor';
import { normalizeFilePath } from './extractor';

export interface PreviewMessage {
  __lyra: true;
  type: 'navigate' | 'error' | 'console-error' | 'ready';
  path?: string;
  message?: string;
  source?: string;
  line?: number;
}

/** Resolve a relative href against the directory of the current page. */
export function resolvePreviewPath(fromPath: string, href: string): string {
  // Strip query string and hash
  const clean = href.split('#')[0].split('?')[0].trim();
  if (!clean) return '';

  if (clean.startsWith('/')) {
    return normalizeFilePath(clean);
  }

  const fromDir = normalizeFilePath(fromPath).split('/').slice(0, -1);
  const parts = clean.split('/');
  const stack = [...fromDir];

  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }

  return stack.join('/');
}

function isExternalUrl(url: string): boolean {
  return /^(https?:)?\/\//i.test(url) || /^(data|mailto|tel|javascript|blob):/i.test(url);
}

/**
 * Resolve a reference to a file that actually exists in the project, tolerating
 * the path mistakes models commonly make (e.g. writing root-relative nav hrefs
 * like "pages/kontak.html" inside a page that already lives in pages/):
 * 1. strict relative resolution from the current page
 * 2. the href taken as root-relative
 * 3. unique basename match anywhere in the project
 * Returns null when nothing matches.
 */
export function resolveExistingPath(
  paths: string[],
  fromPath: string,
  href: string,
): string | null {
  const strict = resolvePreviewPath(fromPath, href);
  if (strict && paths.includes(strict)) return strict;

  const rootRelative = normalizeFilePath(href.split('#')[0].split('?')[0]);
  if (rootRelative && paths.includes(rootRelative)) return rootRelative;

  const basename = (strict || rootRelative).split('/').pop() || '';
  if (basename) {
    const candidates = paths.filter(p => p.split('/').pop() === basename);
    if (candidates.length === 1) return candidates[0];
  }

  return null;
}

/** List all HTML pages in the project, index.html first. */
export function listHtmlPages(files: ArtifactFile[]): string[] {
  const pages = files.filter(f => f.path.endsWith('.html')).map(f => f.path);
  return pages.sort((a, b) => {
    if (a === 'index.html') return -1;
    if (b === 'index.html') return 1;
    return a.localeCompare(b);
  });
}

/** Runtime injected into every preview page: error capture + link interception. */
const RUNTIME_SCRIPT = `(function(){
  function send(msg){ try { parent.postMessage(msg, '*'); } catch(e){} }
  send({ __lyra: true, type: 'ready' });
  window.addEventListener('error', function(e){
    send({ __lyra: true, type: 'error', message: e.message, source: e.filename || '', line: e.lineno || 0 });
  });
  window.addEventListener('unhandledrejection', function(e){
    var r = e.reason;
    send({ __lyra: true, type: 'error', message: 'Unhandled rejection: ' + (r && r.message ? r.message : String(r)) });
  });
  var origError = console.error;
  console.error = function(){
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (typeof a === 'string') { parts.push(a); }
      else { try { parts.push(JSON.stringify(a)); } catch(e) { parts.push(String(a)); } }
    }
    send({ __lyra: true, type: 'console-error', message: parts.join(' ') });
    origError.apply(console, arguments);
  };
  document.addEventListener('click', function(e){
    var el = e.target;
    while (el && el !== document && (!el.tagName || el.tagName.toLowerCase() !== 'a')) { el = el.parentNode; }
    if (!el || el === document) return;
    var href = el.getAttribute('href');
    if (!href) return;
    if (href.indexOf('#lyra-nav=') === 0) {
      e.preventDefault();
      send({ __lyra: true, type: 'navigate', path: href.slice(10) });
      return;
    }
    if (href.charAt(0) === '#') return; // in-page anchor
    e.preventDefault();
    if (/^(https?:)?\\/\\//i.test(href) || /^(mailto|tel):/i.test(href)) return; // external — blocked in sandbox
    send({ __lyra: true, type: 'navigate', path: href });
  }, true);
})();`;

/**
 * Build a complete standalone HTML document for one page of the project.
 * CSS and JS references to project files are inlined; internal SVG images
 * become data URIs; the runtime script is injected for error capture and
 * multi-page navigation.
 */
export function buildPageHtml(files: ArtifactFile[], pagePath: string): string {
  const fileMap = new Map<string, ArtifactFile>();
  for (const f of files) {
    fileMap.set(normalizeFilePath(f.path), f);
  }

  let page = fileMap.get(normalizeFilePath(pagePath));
  if (!page) {
    page =
      fileMap.get('index.html') ||
      files.find(f => f.path.endsWith('.html')) ||
      files[0];
  }
  if (!page) return '<!DOCTYPE html><html><body></body></html>';

  let html = page.content.trim();
  if (!html.toLowerCase().startsWith('<!doctype') && !html.toLowerCase().startsWith('<html')) {
    html = `<!DOCTYPE html>\n<html lang="id">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n<body>${html}</body>\n</html>`;
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return html;
  }

  const paths = Array.from(fileMap.keys());
  // Smart lookup: tolerates root-relative hrefs written from nested pages
  const lookup = (href: string): ArtifactFile | undefined => {
    const resolved = resolveExistingPath(paths, page!.path, href);
    return resolved ? fileMap.get(resolved) : undefined;
  };

  // Inline stylesheets that point to project files
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!href || isExternalUrl(href)) return;
    const target = lookup(href);
    if (target) {
      const style = doc.createElement('style');
      style.textContent = `\n${target.content}\n`;
      link.replaceWith(style);
    } else {
      link.remove(); // dead reference — avoid 404 noise
    }
  });

  // Inline scripts that point to project files (order preserved)
  doc.querySelectorAll('script[src]').forEach(script => {
    const src = script.getAttribute('src') || '';
    if (!src || isExternalUrl(src)) return;
    const target = lookup(src);
    if (target) {
      const inline = doc.createElement('script');
      inline.textContent = `\n${target.content}\n`;
      script.replaceWith(inline);
    } else {
      script.remove();
    }
  });

  // Rewrite internal links to safe anchors: even if the click interceptor
  // fails, a "#lyra-nav=..." anchor jump can never blank the iframe document.
  // Point each link at the best EXISTING file; fall back to the strict
  // resolution so the missing-page toast can name the intended target.
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || isExternalUrl(href)) return;
    const existing = resolveExistingPath(paths, page!.path, href);
    a.setAttribute('href', '#lyra-nav=' + (existing ?? resolvePreviewPath(page!.path, href)));
  });

  // Internal SVG images → data URIs
  doc.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (!src || isExternalUrl(src)) return;
    const target = lookup(src);
    if (target && target.path.endsWith('.svg')) {
      img.setAttribute('src', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(target.content));
    }
  });

  // Inject runtime script at the start of <head> so errors are caught early
  const runtime = doc.createElement('script');
  runtime.textContent = RUNTIME_SCRIPT;
  const head = doc.head || doc.documentElement;
  head.insertBefore(runtime, head.firstChild);

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}
