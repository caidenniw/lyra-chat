import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

// ── Parse markdown into blocks (text, code, code-progress, table) ──
type Block =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language?: string }
  | { type: 'code-progress'; content: string; language?: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push(...splitTables(content.slice(lastIndex, match.index)));
    }
    blocks.push({ type: 'code', content: match[2].trimEnd(), language: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex);

  // Check for incomplete code block (opening ``` without closing ```)
  const incompleteMatch = remaining.match(/^```(\w*)\n([\s\S]*)$/);
  if (incompleteMatch) {
    // There's text before the incomplete code block
    const beforeCode = remaining.slice(0, remaining.indexOf('```'));
    if (beforeCode.trim()) {
      blocks.push(...splitTables(beforeCode));
    }
    blocks.push({
      type: 'code-progress',
      content: incompleteMatch[2],
      language: incompleteMatch[1] || undefined,
    });
  } else if (remaining.trim()) {
    blocks.push(...splitTables(remaining));
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
      // Skip separator line (index 1)
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
    // Table row: starts and ends with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Table separator: |---|---|
      if (/^\|[\s:-]+\|/.test(trimmed) && /^(\|[\s:-]+)+\|$/.test(trimmed)) {
        // separator line — just mark as part of table
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

// ── Render inline formatting ──
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, i) => {
    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-text">{part.slice(2, -2)}</strong>;
    }
    // Italic
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i} className="italic text-text-muted">{part.slice(1, -1)}</em>;
    }
    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-primary-subtle text-primary text-[14px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Link
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary-hover">
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Render a single table block ──
function renderTable(headers: string[], rows: string[][], key: string) {
  return (
    <div key={key} className="my-3 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-[14px] border-collapse min-w-0">
        <thead>
          <tr className="border-b border-border bg-bg-alt/50">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-text whitespace-nowrap">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border last:border-0 hover:bg-bg-alt/30 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-text-muted whitespace-nowrap">
                  {renderInline(cell)}
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
export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = parseBlocks(content);

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
          return renderTable(block.headers, block.rows, `table-${i}`);
        }

        // Text block — render line by line
        const lines = block.content.split('\n');
        return (
          <div key={i} className="space-y-1">
            {lines.map((line, j) => {
              const key = `${i}-${j}`;

              // Headings
              const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
              if (headingMatch) {
                const level = headingMatch[1].length;
                const size = level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm';
                const weight = level <= 3 ? 'font-bold' : 'font-semibold';
                return <div key={key} className={`${weight} text-text mt-3 mb-1 ${size}`}>{renderInline(headingMatch[2])}</div>;
              }

              // Horizontal rule
              if (/^---+$/.test(line.trim())) {
                return <hr key={key} className="my-3 border-border-light" />;
              }

              // Blockquote: > text
              if (/^>\s+/.test(line)) {
                const text = line.replace(/^>\s+/, '');
                return (
                  <div key={key} className="border-l-3 border-primary/40 pl-3 py-1 my-1 bg-primary/5 rounded-r-lg">
                    <span className="text-text-muted text-sm italic">{renderInline(text)}</span>
                  </div>
                );
              }

              // Unordered list: - text or * text
              if (/^[-*]\s+/.test(line)) {
                const text = line.replace(/^[-*]\s+/, '');
                // Nested list
                const nest = line.match(/^(\s*)[-*]\s+/);
                const indent = nest ? nest[1].length : 0;
                return (
                  <div key={key} className="flex gap-2" style={{ paddingLeft: `${indent * 4}px` }}>
                    <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-relaxed">{renderInline(text)}</span>
                  </div>
                );
              }

              // Ordered list: 1. text
              const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
              if (olMatch) {
                return (
                  <div key={key} className="flex gap-2">
                    <span className="text-primary font-medium min-w-[16px] flex-shrink-0">{olMatch[1]}.</span>
                    <span className="leading-relaxed">{renderInline(olMatch[2])}</span>
                  </div>
                );
              }

              // Empty line
              if (!line.trim()) {
                return <div key={key} className="h-2" />;
              }

              // Normal paragraph
              return <div key={key} className="leading-relaxed">{renderInline(line)}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
});
