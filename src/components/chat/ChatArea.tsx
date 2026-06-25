import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../layout/AppShell';

interface ChatAreaProps {
  messages: Message[];
  streamingMessageId?: string | null;
}

export function ChatArea({ messages, streamingMessageId }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessageId]);

  return (
    <div className="flex-1 overflow-y-auto">
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
