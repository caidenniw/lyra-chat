import React, { useState, useCallback } from 'react';
import katex from 'katex';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
}

// ── Block types ──
type Block =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language?: string }
  | { type: 'code-progress'; content: string; language?: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'math'; content: string }
  | { type: 'math-pending'; content: string }; // incomplete math during streaming

// ── KaTeX render with structured error handling ──
interface KaTeXResult {
  html: string;
  success: boolean;
  error?: string;
}

function renderKaTeX(latex: string, displayMode: boolean): KaTeXResult {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
      output: 'html',
    });
    // KaTeX with throwOnError:false still renders error HTML internally
    const hasError = html.includes('katex-error');
    return { html, success: !hasError, error: hasError ? 'Formula tidak valid' : undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { html: '', success: false, error: msg };
  }
}

// ── Check if $ is currency ──
function isCurrencyDollar(text: string, dollarIndex: number): boolean {
  if (dollarIndex + 1 < text.length && /\d/.test(text[dollarIndex + 1])) {
    return true;
  }
  return false;
}

// ── Check if display math is likely incomplete (streaming) ──
function hasIncompleteDisplayMath(content: string): boolean {
  // Count $$ occurrences — odd number means incomplete
  const matches = content.match(/\$\$/g);
  return matches !== null && matches.length % 2 !== 0;
}

// ── Check if inline math is likely incomplete (streaming) ──
function hasIncompleteInlineMath(text: string): boolean {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '$') {
      // Skip $$
      if (i + 1 < text.length && text[i + 1] === '$') {
        i++;
        continue;
      }
      // Skip currency
      if (i + 1 < text.length && /\d/.test(text[i + 1])) {
        continue;
      }
      count++;
    }
  }
  return count % 2 !== 0;
}

// ── Copy button component for display math ──
function MathCopyButton({ latex }: { latex: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const texSource = `$$${latex}$$`;
    navigator.clipboard.writeText(texSource).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = texSource;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [latex]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md
        text-[11px] font-medium transition-all duration-200
        bg-primary/5 text-text-dim hover:bg-primary/10 hover:text-text-muted
        border border-transparent hover:border-border-light
        opacity-0 group-hover:opacity-100"
      title="Copy LaTeX"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Tersalin</span>
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>LaTeX</span>
        </>
      )}
    </button>
  );
}

// ── Display math block component ──
function MathBlock({ latex, pending }: { latex: string; pending?: boolean }) {
  if (pending) {
    return (
      <div className="my-2 px-2 font-mono text-sm text-text-dim leading-relaxed overflow-x-auto">
        <span className="text-accent/50 mr-1">$$</span>
        {latex}
        <span className="inline-block w-1.5 h-3.5 bg-text-dim/40 ml-0.5 animate-pulse rounded-sm" />
      </div>
    );
  }

  const result = renderKaTeX(latex, true);

  if (!result.success) {
    return (
      <div className="my-2 px-1 py-2 rounded-lg overflow-x-auto">
        <div className="flex items-start gap-2 mb-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" className="text-accent/60 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[11px] text-accent/60">{result.error}</span>
        </div>
        <pre className="font-mono text-[12px] text-text-dim leading-relaxed whitespace-pre-wrap break-all">
          {latex}
        </pre>
      </div>
    );
  }

  return (
    <div className="my-2 relative group overflow-x-auto katex-display">
      <div dangerouslySetInnerHTML={{ __html: result.html }} />
      <MathCopyButton latex={latex} />
    </div>
  );
}

// ── Normalize LaTeX delimiters ──
// AI models often use \[...\] and \(...\) which KaTeX doesn't natively handle.
// Convert to $$...$$ and $...$ so the rest of the parser works uniformly.
// IMPORTANT: Skip content inside code blocks to avoid corrupting code.
function normalizeLatexDelimiters(content: string): string {
  // Step 1: Extract and protect code blocks with placeholders
  const codeBlocks: string[] = [];
  let result = content.replace(/```(\w*)\n([\s\S]*?)```/g, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `__CODE_BLOCK_${idx}__`;
  });

  // Also protect incomplete code blocks (streaming)
  const lastOpening = result.lastIndexOf('```');
  if (lastOpening !== -1) {
    const idx = codeBlocks.length;
    codeBlocks.push(result.slice(lastOpening));
    result = result.slice(0, lastOpening) + `__CODE_BLOCK_${idx}__`;
  }

  // Step 2: Normalize LaTeX delimiters on non-code text only
  // \[...\] -> $$...$$ (display math)
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    return `$$${math}$$`;
  });

  // \(...\) -> $...$ (inline math)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    return `$${math}$`;
  });

  // Step 3: Restore code blocks
  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
    return codeBlocks[parseInt(idx)];
  });

  return result;
}

// ── Parse blocks ──
function parseBlocks(rawContent: string, streaming?: boolean): Block[] {
  const content = normalizeLatexDelimiters(rawContent);
  const blocks: Block[] = [];
  const combinedRegex = /(?:\$\$([\s\S]*?)\$\$|```(\w*)\n([\s\S]*?)```)/g;
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push(...splitTables(content.slice(lastIndex, match.index)));
    }

    if (match[1] !== undefined) {
      blocks.push({ type: 'math', content: match[1].trim() });
    } else {
      blocks.push({ type: 'code', content: match[3].trimEnd(), language: match[2] || undefined });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex);

  // Handle incomplete code block
  const openingIdx = remaining.lastIndexOf('```');
  if (openingIdx !== -1) {
    const afterBackticks = remaining.slice(openingIdx + 3);
    const newlineIdx = afterBackticks.indexOf('\n');
    if (newlineIdx !== -1 || afterBackticks.trim() === '') {
      const language = newlineIdx !== -1 ? afterBackticks.slice(0, newlineIdx).trim() : '';
      const codeContent = newlineIdx !== -1 ? afterBackticks.slice(newlineIdx + 1) : '';

      const beforeCode = remaining.slice(0, openingIdx);
      if (beforeCode.trim()) {
        blocks.push(...splitTables(beforeCode));
      }

      blocks.push({
        type: 'code-progress',
        content: codeContent,
        language: language || undefined,
      });
    } else {
      if (remaining.trim()) {
        blocks.push(...splitTables(remaining));
      }
    }
  } else if (remaining.trim()) {
    blocks.push(...splitTables(remaining));
  }

  // ── Streaming: detect incomplete display math in text blocks ──
  if (streaming) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block.type === 'text' && hasIncompleteDisplayMath(block.content)) {
        // Split: everything before last $$ is text, the rest is pending math
        const lastDoubleDollar = block.content.lastIndexOf('$$');
        const before = block.content.slice(0, lastDoubleDollar);
        const after = block.content.slice(lastDoubleDollar + 2);

        // Replace this text block
        blocks.splice(i, 1);
        if (before.trim()) {
          blocks.splice(i, 0, ...splitTables(before));
          i++;
        }
        blocks.splice(i + (before.trim() ? splitTables(before).length : 0), 0, {
          type: 'math-pending',
          content: after,
        });
      }
    }
  }

  return blocks;
}

// ── Split text into table and non-table chunks ──
function splitTables(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let tableLines: string[] = [];
  let textBuffer: string[] = [];

  function flushText() {
    if (textBuffer.length > 0) {
      const t = textBuffer.join('\n').trim();
      if (t) blocks.push({ type: 'text', content: t });
      textBuffer = [];
    }
  }

  function flushTable() {
    if (tableLines.length >= 2) {
      const headers = tableLines[0]
        .split('|')
        .map(c => c.trim())
        .filter(c => c !== '');
      const rows = tableLines.slice(2).map(line =>
        line.split('|').map(c => c.trim()).filter(c => c !== '')
      );
      if (headers.length > 0) {
        blocks.push({ type: 'table', headers, rows });
      }
    }
    tableLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (/^\|[\s:-]+\|/.test(trimmed) && /^(\|[\s:-]+)+\|$/.test(trimmed)) {
        tableLines.push(trimmed);
        continue;
      }
      flushText();
      tableLines.push(trimmed);
    } else {
      if (tableLines.length > 0) {
        flushTable();
      }
      textBuffer.push(line);
    }
  }

  flushText();
  flushTable();

  return blocks;
}

// ── Inline math renderer ──
function InlineMath({ latex }: { latex: string }) {
  const result = renderKaTeX(latex, false);

  if (!result.success) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent text-[13px] font-mono"
        title={result.error}>
        {latex}
      </code>
    );
  }

  return (
    <span
      className="katex-inline align-middle"
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}

// ── Parse inline formatting with math support ──
function renderInline(text: string, streaming?: boolean): React.ReactNode[] {
  const parts: { text: string; type: 'text' | 'math' }[] = [];

  // During streaming, check if there's an incomplete inline math at the end
  let processText = text;
  let pendingSuffix = '';

  if (streaming && hasIncompleteInlineMath(text)) {
    const lastDollar = text.lastIndexOf('$');
    // Make sure it's not a $$ or currency
    if (lastDollar > 0 && text[lastDollar - 1] !== '$' && !isCurrencyDollar(text, lastDollar)) {
      processText = text.slice(0, lastDollar);
      pendingSuffix = text.slice(lastDollar + 1);
    }
  }

  // Extract inline math $...$
  let remaining = processText;
  let buffer = '';

  while (remaining.length > 0) {
    const dollarIdx = remaining.indexOf('$');
    if (dollarIdx === -1) {
      buffer += remaining;
      remaining = '';
      break;
    }

    // Skip $$
    if (dollarIdx + 1 < remaining.length && remaining[dollarIdx + 1] === '$') {
      buffer += remaining.slice(0, dollarIdx + 2);
      remaining = remaining.slice(dollarIdx + 2);
      continue;
    }

    // Skip currency
    if (isCurrencyDollar(remaining, dollarIdx)) {
      buffer += remaining.slice(0, dollarIdx + 1);
      remaining = remaining.slice(dollarIdx + 1);
      continue;
    }

    // Find closing $
    const closeIdx = remaining.indexOf('$', dollarIdx + 1);
    if (closeIdx === -1) {
      buffer += remaining;
      remaining = '';
      break;
    }

    // Skip $$
    if (closeIdx + 1 < remaining.length && remaining[closeIdx + 1] === '$') {
      buffer += remaining.slice(0, closeIdx + 2);
      remaining = remaining.slice(closeIdx + 2);
      continue;
    }

    const mathContent = remaining.slice(dollarIdx + 1, closeIdx);
    if (mathContent.trim().length > 0) {
      // Add text BEFORE the opening $ to buffer
      if (dollarIdx > 0) {
        buffer += remaining.slice(0, dollarIdx);
      }
      if (buffer) {
        parts.push({ text: buffer, type: 'text' });
        buffer = '';
      }
      parts.push({ text: mathContent, type: 'math' });
    } else {
      buffer += remaining.slice(0, closeIdx + 1);
    }
    remaining = remaining.slice(closeIdx + 1);
  }

  // Append pending streaming suffix
  if (pendingSuffix) {
    buffer += pendingSuffix;
  }

  if (buffer) {
    parts.push({ text: buffer, type: 'text' });
  }

  // Render each part
  const result: React.ReactNode[] = [];

  parts.forEach((part, idx) => {
    if (part.type === 'math') {
      result.push(<InlineMath key={`math-${idx}`} latex={part.text} />);
      return;
    }

    // Parse markdown inline formatting
    const textParts = part.text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
    textParts.forEach((tp, i) => {
      const key = `${idx}-${i}`;
      if (tp.startsWith('**') && tp.endsWith('**')) {
        result.push(<strong key={key} className="font-semibold text-text">{tp.slice(2, -2)}</strong>);
      } else if (tp.startsWith('*') && tp.endsWith('*') && !tp.startsWith('**')) {
        result.push(<em key={key} className="italic text-text-muted">{tp.slice(1, -1)}</em>);
      } else if (tp.startsWith('`') && tp.endsWith('`')) {
        result.push(
          <code key={key} className="px-1.5 py-0.5 rounded bg-primary-subtle text-primary text-[14px] font-mono">
            {tp.slice(1, -1)}
          </code>
        );
      } else {
        const linkMatch = tp.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          result.push(
            <a key={key} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary-hover">
              {linkMatch[1]}
            </a>
          );
        } else if (tp) {
          result.push(<span key={key}>{tp}</span>);
        }
      }
    });
  });

  return result;
}

// ── Render table ──
function renderTable(headers: string[], rows: string[][], key: string, streaming?: boolean) {
  return (
    <div key={key} className="my-3 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-[14px] border-collapse min-w-0">
        <thead>
          <tr className="border-b border-border bg-bg-alt/50">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-text whitespace-nowrap">
                {renderInline(h, streaming)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border last:border-0 hover:bg-bg-alt/30 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-text-muted whitespace-nowrap">
                  {renderInline(cell, streaming)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main renderer ──
export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, streaming }: MarkdownRendererProps) {
  const blocks = parseBlocks(content, streaming);

  return (
    <div className="space-y-1 w-full max-w-full overflow-hidden">
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          return <CodeBlock key={i} code={block.content} language={block.language} />;
        }

        if (block.type === 'code-progress') {
          return <CodeBlock key={i} code={block.content} language={block.language} streaming />;
        }

        if (block.type === 'table') {
          return renderTable(block.headers, block.rows, `table-${i}`, streaming);
        }

        if (block.type === 'math') {
          return <MathBlock key={i} latex={block.content} />;
        }

        if (block.type === 'math-pending') {
          return <MathBlock key={i} latex={block.content} pending />;
        }

        // Text block
        const lines = block.content.split('\n');
        return (
          <div key={i} className="space-y-1">
            {lines.map((line, j) => {
              const key = `${i}-${j}`;

              const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
              if (headingMatch) {
                const level = headingMatch[1].length;
                const size = level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm';
                const weight = level <= 3 ? 'font-bold' : 'font-semibold';
                return <div key={key} className={`${weight} text-text mt-3 mb-1 ${size}`}>{renderInline(headingMatch[2], streaming)}</div>;
              }

              if (/^---+$/.test(line.trim())) {
                return <hr key={key} className="my-3 border-border-light" />;
              }

              if (/^>\s+/.test(line)) {
                const text = line.replace(/^>\s+/, '');
                return (
                  <div key={key} className="border-l-3 border-primary/40 pl-3 py-1 my-1 bg-primary/5 rounded-r-lg">
                    <span className="text-text-muted text-sm italic">{renderInline(text, streaming)}</span>
                  </div>
                );
              }

              if (/^[-*]\s+/.test(line)) {
                const text = line.replace(/^[-*]\s+/, '');
                const nest = line.match(/^(\s*)[-*]\s+/);
                const indent = nest ? nest[1].length : 0;
                return (
                  <div key={key} className="flex gap-2" style={{ paddingLeft: `${indent * 4}px` }}>
                    <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-relaxed">{renderInline(text, streaming)}</span>
                  </div>
                );
              }

              const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
              if (olMatch) {
                return (
                  <div key={key} className="flex gap-2">
                    <span className="text-primary font-medium min-w-[16px] flex-shrink-0">{olMatch[1]}.</span>
                    <span className="leading-relaxed">{renderInline(olMatch[2], streaming)}</span>
                  </div>
                );
              }

              if (!line.trim()) {
                return <div key={key} className="h-2" />;
              }

              return <div key={key} className="leading-relaxed">{renderInline(line, streaming)}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
});
