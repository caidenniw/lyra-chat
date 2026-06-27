// src/lib/ai/streamWorker.ts — Web Worker for AI streaming
// Runs in a separate thread, not affected by tab visibility throttling

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamRequest {
  type: 'stream';
  messages: ChatMessage[];
  model: string;
  apiBase: string;
}

interface CancelRequest {
  type: 'cancel';
}

type WorkerRequest = StreamRequest | CancelRequest;

interface TokenMessage {
  type: 'token';
  data: string;
}

interface ReasoningMessage {
  type: 'reasoning';
  data: string;
}

interface DoneMessage {
  type: 'done';
}

interface ErrorMessage {
  type: 'error';
  data: string;
}

let abortController: AbortController | null = null;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const request = e.data;

  if (request.type === 'cancel') {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    return;
  }

  if (request.type === 'stream') {
    // Cancel any existing stream
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    try {
      await runStream(request, abortController.signal);
    } catch (err) {
      // Only report error if not from our own abort
      if (!abortController.signal.aborted) {
        const msg: ErrorMessage = { type: 'error', data: String(err) };
        self.postMessage(msg);
      }
    }
  }
};

async function runStream(
  request: StreamRequest,
  signal: AbortSignal,
): Promise<void> {
  const { messages, model, apiBase } = request;

  // Process messages — handle multimodal content arrays
  const processedMessages = messages.map(msg => {
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
    max_tokens: 4096,
  };

  const response = await fetch(`${apiBase}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const msg: ErrorMessage = { type: 'error', data: `API error ${response.status}: ${errorText}` };
    self.postMessage(msg);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const msg: ErrorMessage = { type: 'error', data: 'No response body' };
    self.postMessage(msg);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const processBuffer = (flush = false): boolean => {
    const lines = buffer.split('\n');
    buffer = flush ? '' : (lines.pop() || '');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        const msg: DoneMessage = { type: 'done' };
        self.postMessage(msg);
        return true;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        // Handle actual content (final response)
        const content = delta.content;
        if (content) {
          const msg: TokenMessage = { type: 'token', data: content };
          self.postMessage(msg);
        }

        // Handle reasoning content (DeepSeek format: reasoning_content)
        const reasoningContent = delta.reasoning_content;
        if (reasoningContent) {
          const msg: ReasoningMessage = { type: 'reasoning', data: reasoningContent };
          self.postMessage(msg);
        }

        // Handle reasoning content (MiMo format: reasoning)
        const reasoning = delta.reasoning;
        if (reasoning) {
          const msg: ReasoningMessage = { type: 'reasoning', data: reasoning };
          self.postMessage(msg);
        }
      } catch {
        // Skip malformed JSON
      }
    }
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer) processBuffer(true);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const isDone = processBuffer(false);
    if (isDone) return;
  }

  const msg: DoneMessage = { type: 'done' };
  self.postMessage(msg);
}
