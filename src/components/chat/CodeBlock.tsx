import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js/lib/core';

// Register common languages
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import php from 'highlight.js/lib/languages/php';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

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
hljs.registerLanguage('php', php);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('docker', dockerfile);

// Language display names
const LANG_NAMES: Record<string, string> = {
  javascript: 'JavaScript', js: 'JavaScript', jsx: 'JSX',
  typescript: 'TypeScript', ts: 'TypeScript', tsx: 'TSX',
  python: 'Python', py: 'Python',
  css: 'CSS', html: 'HTML', xml: 'XML',
  json: 'JSON', bash: 'Bash', sh: 'Bash', shell: 'Bash',
  sql: 'SQL', php: 'PHP', java: 'Java',
  cpp: 'C++', c: 'C', csharp: 'C#', cs: 'C#',
  go: 'Go', rust: 'Rust', rs: 'Rust',
  yaml: 'YAML', yml: 'YAML',
  markdown: 'Markdown', md: 'Markdown',
  dockerfile: 'Docker', docker: 'Docker',
};

function detectLanguage(code: string): string {
  try {
    const result = hljs.highlightAuto(code, [
      'javascript', 'typescript', 'python', 'css', 'html',
      'json', 'bash', 'sql', 'php', 'java', 'cpp', 'go', 'rust',
    ]);
    return result.language || 'plaintext';
  } catch {
    return 'plaintext';
  }
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
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

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#1e2a3a] shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d1b2a] border-b border-[#1e2a3a]">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
          {displayName}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium
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
      </div>

      {/* Code */}
      <div className="bg-[#0a1628] overflow-x-auto">
        <pre className="p-4 text-[13px] leading-relaxed">
          <code
            className="font-mono text-slate-300"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  );
}
