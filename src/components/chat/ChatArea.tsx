import { useEffect, useRef, useState, UIEvent } from 'react';
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
    // Calculate how far we are from the bottom (with a 50px threshold buffer)
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setIsAutoScrollEnabled(isAtBottom);
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-5">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={streamingMessageId === msg.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
