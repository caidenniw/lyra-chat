import { Bot, User, Copy, Check, ThumbsUp, ThumbsDown, Info, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useState, memo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { Message } from '../layout/AppShell';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onRetry?: () => void;
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming = false, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isEmpty = !message.content && !message.reasoningContent && isStreaming;
  const hasReasoning = !!message.reasoningContent;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // System message — centered info notice
  if (isSystem) {
    return (
      <div className="flex justify-center my-3 md:my-4 animate-message-in">
        <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-primary-subtle border border-primary/10 text-xs md:text-sm text-primary">
          <Info size={14} className="flex-shrink-0 md:hidden" />
          <Info size={16} className="flex-shrink-0 hidden md:block" />
          <span className="font-medium">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 md:gap-3 animate-message-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar - assistant */}
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-soft">
          <Bot size={14} className="text-white md:hidden" />
          <Bot size={16} className="text-white hidden md:block" />
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[90%] md:max-w-[85%] min-w-0`}>
        {/* Label */}
        <div className={`text-[11px] md:text-[12px] font-medium mb-0.5 md:mb-1 px-1 ${isUser ? 'text-text-muted' : 'text-primary'}`}>
          {isUser ? 'Kamu' : 'Lyra'}
        </div>

        {/* Attached files preview — only in user messages */}
        {isUser && message.files && message.files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-xl bg-primary-subtle border border-primary/10 text-[11px] md:text-xs">
                {file.type.startsWith('image/') ? (
                  <img src={file.preview} alt={file.name} className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] md:text-[11px] font-mono text-primary font-bold uppercase">
                    {file.name.split('.').pop()?.slice(0, 3) || '?'}
                  </div>
                )}
                <div className="max-w-[80px] md:max-w-[120px] truncate text-text-muted">{file.name}</div>
              </div>
            ))}
          </div>
        )}

        {/* Bubble */}
        <div className={`group relative rounded-2xl px-3 py-2.5 md:px-4 md:py-3 transition-all duration-300 ease-out max-w-full min-w-0 overflow-hidden ${
          isUser
            ? 'bg-user-bg text-user-text rounded-br-md shadow-soft'
            : message.isError
              ? 'bg-red-50 border border-red-200 text-text rounded-bl-md'
              : 'bg-assistant-bg border border-border-light text-text rounded-bl-md'
        }`}>
          {isEmpty ? (
            /* Typing animation dots */
            <div className="flex items-center gap-1.5 py-2 px-1">
              <span className="w-2 h-2 rounded-full bg-primary/50 typing-dot" />
              <span className="w-2 h-2 rounded-full bg-primary/50 typing-dot" />
              <span className="w-2 h-2 rounded-full bg-primary/50 typing-dot" />
            </div>
          ) : isUser ? (
            /* User — plain text */
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : (
            /* AI — markdown with code blocks */
            <div className={`text-sm leading-relaxed ${isStreaming ? 'animate-content-fade' : ''}`}>
              {/* Reasoning / Thinking section — collapsible */}
              {hasReasoning && (
                <div className="mb-2 last:mb-0">
                  <button
                    onClick={() => setReasoningOpen(!reasoningOpen)}
                    className="flex items-center gap-1.5 text-[11px] md:text-xs text-text-dim hover:text-text-muted transition-colors mb-1"
                  >
                    {reasoningOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className="font-medium">Proses berpikir</span>
                    {isStreaming && !reasoningOpen && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse ml-1" />
                    )}
                  </button>
                  {reasoningOpen && (
                    <div className="text-[11px] md:text-xs text-text-dim/70 italic border-l-2 border-primary/20 pl-3 py-1 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {message.reasoningContent}
                    </div>
                  )}
                </div>
              )}
              <MarkdownRenderer content={message.content} />
              {/* Blinking cursor during streaming */}
              {isStreaming && (
                <span className="ai-cursor" />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isUser && !isEmpty && (
          <div className="flex items-center gap-0.5 md:gap-1 mt-1 md:mt-1.5 px-1">
            {onRetry ? (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors btn-press"
              >
                <RotateCcw size={12} />
                <span>Coba lagi</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleCopy}
                  className="p-1 md:p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors btn-press"
                >
                  {copied ? <Check size={12} className="text-green-500 md:hidden" /> : <Copy size={12} className="md:hidden" />}
                  {copied ? <Check size={13} className="text-green-500 hidden md:block" /> : <Copy size={13} className="hidden md:block" />}
                </button>
                <button className="p-1 md:p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors btn-press">
                  <ThumbsUp size={12} className="md:hidden" />
                  <ThumbsUp size={13} className="hidden md:block" />
                </button>
                <button className="p-1 md:p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors btn-press">
                  <ThumbsDown size={12} className="md:hidden" />
                  <ThumbsDown size={13} className="hidden md:block" />
                </button>
              </>
            )}
            <span className="text-[9px] md:text-[10px] text-text-dim ml-1">
              {message.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* User timestamp */}
        {isUser && (
          <div className="flex items-center justify-end gap-1.5 md:gap-2 mt-0.5 md:mt-1 px-1">
            <span className="text-[9px] md:text-[10px] text-text-dim">
              {message.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={handleCopy}
              className="p-1 md:p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors btn-press flex items-center gap-1"
              title="Salin pesan"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          </div>
        )}
      </div>

      {/* Avatar - user */}
      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft">
          <User size={14} className="text-white md:hidden" />
          <User size={16} className="text-white hidden md:block" />
        </div>
      )}
    </div>
  );
});
