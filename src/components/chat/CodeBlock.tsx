import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import DOMPurify from 'dompurify';

// Register ONLY most common languages (reduced from 17 to 8)
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sql', sql);

// Language display names
const LANG_NAMES: Record<string, string> = {
  javascript: 'JavaScript', js: 'JavaScript', jsx: 'JSX',
  typescript: 'TypeScript', ts: 'TypeScript', tsx: 'TSX',
  python: 'Python', py: 'Python',
  css: 'CSS', html: 'HTML', xml: 'XML',
  json: 'JSON', bash: 'Bash', sh: 'Bash', shell: 'Bash',
  sql: 'SQL',
};

function detectLanguage(code: string): string {
  try {
    const result = hljs.highlightAuto(code, [
      'javascript', 'typescript', 'python', 'css', 'html',
      'json', 'bash', 'sql',
    ]);
    return result.language || 'plaintext';
  } catch {
    return 'plaintext';
  }
}

interface CodeBlockProps {
  code: string;
  language?: string;
  streaming?: boolean;
}

export function CodeBlock({ code, language, streaming = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const lang = language && language !== 'plaintext'
    ? language
    : detectLanguage(code);

  const displayName = LANG_NAMES[lang] || lang;

  let highlighted: string;
  try {
    if (lang && lang !== 'plaintext' && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(code, { language: lang }).value;
    } else {
      highlighted = hljs.highlightAuto(code).value;
    }
  } catch {
    highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sanitize HTML to prevent XSS
  const cleanHtml = DOMPurify.sanitize(highlighted);

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#1e2a3a] shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d1b2a] border-b border-[#1e2a3a]">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">
            {displayName}
          </span>
          {streaming && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400/70">menulis...</span>
            </span>
          )}
        </div>
        {!streaming && (
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-medium
            text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          {copied ? (
            <>
              <Check size={13} className="text-green-400" />
              <span className="text-green-400">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Salin</span>
            </>
          )}
        </button>
        )}
      </div>

      {/* Code */}
      <div className="bg-[#0a1628] overflow-x-auto">
        <pre className="p-3 md:p-4 text-[13px] md:text-[14px] leading-relaxed w-fit min-w-full" style={{ tabSize: 2 }}>
          <code
            className="font-mono text-slate-300"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
          {streaming && (
            <span className="inline-block w-2 h-4 bg-green-400/80 animate-pulse ml-0.5 align-middle" />
          )}
        </pre>
      </div>
    </div>
  );
}
