import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../layout/AppShell';
import type { ArtifactBlock } from '../../lib/artifact/extractor';
import { hasPartialArtifact } from '../../lib/artifact/extractor';

interface ChatAreaProps {
  messages: Message[];
  streamingMessageId?: string | null;
  onRetry?: () => void;
  onContinue?: () => void;
  onShowArtifact?: (artifact: ArtifactBlock) => void;
}

export function ChatArea({ messages, streamingMessageId, onRetry, onContinue, onShowArtifact }: ChatAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isAutoScrollRef = useRef(true);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Detect user scroll via wheel event (for auto-scroll logic)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        isAutoScrollRef.current = false;
      } else if (e.deltaY > 0) {
        const { scrollTop, scrollHeight, clientHeight } = el;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        if (distanceFromBottom < 100) {
          isAutoScrollRef.current = true;
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Show/hide scroll button based on scroll position (always active)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkPosition = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 200);
    };

    el.addEventListener('scroll', checkPosition, { passive: true });
    // Also check when content changes
    checkPosition();
    
    return () => el.removeEventListener('scroll', checkPosition);
  }, [messages]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (!streamingMessageId) return;
    if (!isAutoScrollRef.current) return;
    
    scrollToBottom();
  }, [messages, streamingMessageId, scrollToBottom]);

  // Scroll to bottom when user sends a new message
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user') {
      isAutoScrollRef.current = true;
      setShowScrollButton(false);
      requestAnimationFrame(scrollToBottom);
    }
  }, [messages.length, scrollToBottom]);

  // Button handler — smooth scroll then ensure we reach bottom
  const handleScrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    
    isAutoScrollRef.current = true;
    setShowScrollButton(false);
    
    // Smooth scroll first
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    
    // After animation, ensure we're at the very bottom
    setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 350);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-5 relative">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={streamingMessageId === msg.id}
            onRetry={msg.isError ? onRetry : undefined}
            onContinue={hasPartialArtifact(msg.content) ? onContinue : undefined}
            onShowArtifact={onShowArtifact}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <div className="sticky bottom-6 flex justify-center w-full pointer-events-none pb-2">
          <button
            onClick={handleScrollToBottom}
            className="pointer-events-auto flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface border border-border shadow-medium text-text-dim hover:text-text hover:bg-bg-alt transition-all duration-300 animate-fade-in z-50 btn-press"
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
