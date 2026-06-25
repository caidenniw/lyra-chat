import { useEffect, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { ArrowDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../layout/AppShell';

interface ChatAreaProps {
  messages: Message[];
  streamingMessageId?: string | null;
}

export function ChatArea({ messages, streamingMessageId }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  useEffect(() => {
    if (isAutoScrollEnabled) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, streamingMessageId]);
  
  // Always scroll to bottom on new message submission
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      setIsAutoScrollEnabled(true);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    // Calculate how far we are from the bottom (with a 100px threshold buffer)
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setIsAutoScrollEnabled(isAtBottom);
  };

  const scrollToBottom = () => {
    setIsAutoScrollEnabled(true);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-5 relative">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={streamingMessageId === msg.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to Bottom Button */}
      {!isAutoScrollEnabled && (
        <div className="sticky bottom-6 flex justify-center w-full pointer-events-none pb-2">
          <button
            onClick={scrollToBottom}
            className="pointer-events-auto flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface border border-border shadow-medium text-text-dim hover:text-text hover:bg-bg-alt transition-all duration-200 animate-fade-in z-50 btn-press"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={18} className="md:hidden" />
            <ArrowDown size={20} className="hidden md:block" />
          </button>
        </div>
      )}
    </div>
  );
}
