import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

// Parse markdown content into text and code blocks
function parseMarkdown(content: string): Array<{ type: 'text' | 'code'; content: string; language?: string }> {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  // Match ```language\ncode\n``` blocks
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    // Code block
    parts.push({
      type: 'code',
      content: match[2].trimEnd(),
      language: match[1] || undefined,
    });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts;
}

// Render inline formatting (bold, italic, inline code, links)
function renderInlineText(text: string): React.ReactNode[] {
  // Split by markdown patterns
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, i) => {
    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-text">{part.slice(2, -2)}</strong>;
    }
    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i} className="italic text-text-muted">{part.slice(1, -1)}</em>;
    }
    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-primary-subtle text-primary text-[13px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Links: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary-hover">
          {linkMatch[1]}
        </a>
      );
    }
    // Plain text — preserve line breaks
    return <span key={i}>{part}</span>;
  });
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const parts = parseMarkdown(content);

  return (
    <div className="space-y-1 w-full max-w-full overflow-hidden">
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return <CodeBlock key={i} code={part.content} language={part.language} />;
        }

        // Render text with inline formatting, split by line breaks
        const lines = part.content.split('\n');
        return (
          <div key={i} className="space-y-1">
            {lines.map((line, j) => {
              // Headings: ### text
              const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
              if (headingMatch) {
                const level = headingMatch[1].length;
                const cls = level <= 3 ? 'font-bold text-text mt-3 mb-1' : 'font-semibold text-text mt-2 mb-1';
                const size = level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm';
                return <div key={`${i}-${j}`} className={`${cls} ${size}`}>{renderInlineText(headingMatch[2])}</div>;
              }

              // Horizontal rule
              if (/^---+$/.test(line.trim())) {
                return <hr key={`${i}-${j}`} className="my-3 border-border-light" />;
              }

              // Unordered list
              if (/^[-*]\s+/.test(line)) {
                const text = line.replace(/^[-*]\s+/, '');
                return (
                  <div key={`${i}-${j}`} className="flex gap-2 pl-1">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{renderInlineText(text)}</span>
                  </div>
                );
              }

              // Ordered list
              const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
              if (olMatch) {
                return (
                  <div key={`${i}-${j}`} className="flex gap-2 pl-1">
                    <span className="text-primary font-medium min-w-[16px]">{olMatch[1]}.</span>
                    <span>{renderInlineText(olMatch[2])}</span>
                  </div>
                );
              }

              // Empty line
              if (!line.trim()) {
                return <div key={`${i}-${j}`} className="h-2" />;
              }

              // Normal paragraph
              return <div key={`${i}-${j}`} className="leading-relaxed">{renderInlineText(line)}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
}
