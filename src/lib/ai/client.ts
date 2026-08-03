// src/lib/ai/client.ts — AI Streaming Client

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

function getApiBaseUrl(): string {
  // In dev: Vite proxy → /api/chat → local
  // In prod: Vercel serverless → api/chat.js → OpenCode Zen
  return '/api';
}

export async function streamChat(
  messages: ChatMessage[],
  model: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const apiBase = getApiBaseUrl();

  // Build messages — some may have JSON content (multimodal arrays)
  const processedMessages = messages.map(msg => {
    // If content starts with '[', it's a multimodal content array
    if (msg.role === 'user' && msg.content.startsWith('[{')) {
      try {
        const contentArray = JSON.parse(msg.content);
        return { role: msg.role, content: contentArray };
      } catch {
        return { role: msg.role, content: msg.content };
      }
    }
    return { role: msg.role, content: msg.content };
  });

  const body: Record<string, unknown> = {
    model,
    messages: processedMessages,
    stream: true,
    max_tokens: 16384, // Cukup untuk reasoning + jawaban
  };

  try {
    const response = await fetch(`${apiBase}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      callbacks.onError(`API error ${response.status}: ${errorText}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const processBuffer = (flush = false) => {
      const lines = buffer.split('\n');
      buffer = flush ? '' : (lines.pop() || '');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          callbacks.onDone();
          return true; // Indicate stream is complete
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            callbacks.onToken(content);
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Process any remaining data in buffer
        if (buffer) {
          processBuffer(true);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const isDone = processBuffer(false);
      if (isDone) return;
    }

    callbacks.onDone();
  } catch (error) {
    callbacks.onError(String(error));
  }
}
