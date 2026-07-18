import { useState, useCallback, useEffect, useRef } from 'react';
import { isMultimodalModel, getMultimodalModel, getModelById } from '../lib/ai/models';
import type { Message, AttachedFile } from '../components/layout/AppShell';
import { saveMessages } from '../services/chat';
import { ARTIFACT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT } from '../lib/artifact/templates';

interface UseChatOptions {
  model: string;
  userId?: string;
  sandboxMode?: boolean;
  onModelChange?: (model: string) => void;
}

interface UseChatReturn {
  sendMessage: (content: string, files?: AttachedFile[], conversationId?: string) => void;
  retryLastMessage: () => void;
  continuePartialArtifact: () => void;
  stopStreaming: () => void;
  isStreaming: boolean;
  isReasoning: boolean;
  streamingMessageId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

// Web Worker for streaming — imported via Vite worker plugin
import StreamWorker from '../lib/ai/streamWorker.ts?worker'

export function useChat({ model, userId, sandboxMode, onModelChange }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const currentAssistantContentRef = useRef('');
  const currentUserMsgRef = useRef<Message | null>(null);
  const currentAssistantMsgRef = useRef<Message | null>(null);
  const currentSystemMsgRef = useRef<Message | null>(null);
  const currentConversationIdRef = useRef<string | undefined>(undefined);
  const tokenBufferRef = useRef('');
  const reasoningBufferRef = useRef('');
  const pendingFlushRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  // Create and setup worker
  useEffect(() => {
    const worker = new StreamWorker();
    workerRef.current = worker;

    const flushTokens = () => {
      if (!tokenBufferRef.current) return;
      const batch = tokenBufferRef.current;
      tokenBufferRef.current = '';
      currentAssistantContentRef.current += batch;
      
      const assistantId = currentAssistantMsgRef.current?.id;
      if (!assistantId) return;
      
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: m.content + batch }
            : m
        )
      );
      pendingFlushRef.current = null;
    };

    const flushReasoning = () => {
      if (!reasoningBufferRef.current) return;
      const batch = reasoningBufferRef.current;
      reasoningBufferRef.current = '';
      
      const assistantId = currentAssistantMsgRef.current?.id;
      if (!assistantId) return;
      
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, reasoningContent: (m.reasoningContent || '') + batch }
            : m
        )
      );
    };

    const getFriendlyError = (error: string): string => {
      if (error.includes('503') || error.includes('502') || error.includes('504') || error.includes('timeout')) {
        return '⚠️ **Model sedang sibuk atau timeout.**\nSilakan tekan "Coba lagi" atau ganti model lain.';
      } else if (error.includes('401') || error.includes('provider')) {
        return '⚠️ **Model tidak tersedia.**\nSilakan ganti model atau coba lagi nanti.';
      } else if (error.includes('429') || error.includes('rate')) {
        return '⚠️ **Terlalu banyak permintaan.**\nTunggu sebentar lalu tekan "Coba lagi".';
      } else if (error.includes('network') || error.includes('fetch') || error.includes('Failed')) {
        return '⚠️ **Koneksi terputus.**\nPeriksa internet Anda lalu tekan "Coba lagi".';
      } else if (error.includes('Worker') || error.includes('worker')) {
        return '⚠️ **Gagal memuat AI service.**\nRefresh halaman (Ctrl+Shift+R) lalu coba lagi.';
      }
      return '⚠️ Maaf, terjadi gangguan pada sistem AI. Silakan coba lagi nanti.';
    };

    const handleDone = () => {
      // Flush any remaining tokens
      flushTokens();
      flushReasoning();
      if (pendingFlushRef.current) {
        cancelAnimationFrame(pendingFlushRef.current);
        pendingFlushRef.current = null;
      }

      setIsStreaming(false);
      setStreamingMessageId(null);

      // FIX: If model put everything into reasoning but content is empty,
      // move reasoning to content so it shows in the main response area
      const assistantId = currentAssistantMsgRef.current?.id;
      if (assistantId) {
        setMessages(prev => {
          const msg = prev.find(m => m.id === assistantId);
          if (msg && !msg.content?.trim() && msg.reasoningContent?.trim()) {
            // Model put response in reasoning field — move to content
            currentAssistantContentRef.current = msg.reasoningContent;
            return prev.map(m =>
              m.id === assistantId
                ? { ...m, content: m.reasoningContent || '', reasoningContent: undefined }
                : m
            );
          }
          return prev;
        });
      }

      // Save to Supabase
      const assistantMsg = currentAssistantMsgRef.current;
      const userMsg = currentUserMsgRef.current;
      const systemMsg = currentSystemMsgRef.current;
      const conversationId = currentConversationIdRef.current;
      const finalContent = currentAssistantContentRef.current;

      if (userId && conversationId && assistantMsg && userMsg) {
        const finalAssistantMsg: Omit<Message, 'conversationId'> = {
          ...assistantMsg,
          content: finalContent,
        };
        const msgsToSave: Omit<Message, 'conversationId'>[] = [userMsg, finalAssistantMsg];
        if (systemMsg) msgsToSave.push(systemMsg);
        saveMessages(conversationId, msgsToSave).catch(err => {
          console.error('Failed to save messages:', err);
        });
      }
    };

    const handleError = (error: string) => {
      console.error('[useChat] Chat Error:', error);
      // Reset retry count
      retryCountRef.current = 0;
      
      const friendlyError = getFriendlyError(error);
      const assistantId = currentAssistantMsgRef.current?.id;
      const assistantMsg = currentAssistantMsgRef.current;
      const userMsg = currentUserMsgRef.current;
      const systemMsg = currentSystemMsgRef.current;
      const conversationId = currentConversationIdRef.current;

      if (assistantId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: friendlyError, isError: true }
              : m
          )
        );
      }

      setIsStreaming(false);
      setStreamingMessageId(null);

      if (userId && conversationId && assistantMsg && userMsg) {
        const errorAssistantMsg: Omit<Message, 'conversationId'> = {
          ...assistantMsg,
          content: friendlyError,
        };
        const msgsToSave: Omit<Message, 'conversationId'>[] = [userMsg, errorAssistantMsg];
        if (systemMsg) msgsToSave.push(systemMsg);
        saveMessages(conversationId, msgsToSave).catch(err => {
          console.error('Failed to save error messages:', err);
        });
      }
    };

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;

      if (msg.type === 'token') {
        // Actual content started — no longer reasoning
        setIsReasoning(false);
        // Batch tokens for smooth rendering
        tokenBufferRef.current += msg.data;
        if (!pendingFlushRef.current) {
          pendingFlushRef.current = requestAnimationFrame(flushTokens);
        }
      } else if (msg.type === 'reasoning') {
        // Reasoning/thinking phase
        setIsReasoning(true);
        // Batch reasoning tokens — flush more frequently for responsiveness
        reasoningBufferRef.current += msg.data;
        if (reasoningBufferRef.current.length >= 20 || !pendingFlushRef.current) {
          flushReasoning();
        }
      } else if (msg.type === 'done') {
        // Flush any remaining reasoning before done
        flushReasoning();
        setIsReasoning(false);
        handleDone();
      } else if (msg.type === 'error') {
        setIsReasoning(false);
        handleError(msg.data);
      }
    };

    worker.onerror = (e) => {
      handleError(e.message);
    };

    // Flush tokens when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (tokenBufferRef.current) flushTokens();
        if (reasoningBufferRef.current) flushReasoning();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      worker.terminate();
      workerRef.current = null;
    };
  }, [userId]);

  const sendMessage = useCallback((content: string, files?: AttachedFile[], conversationId?: string) => {
    const worker = workerRef.current;
    if (!worker) return;

    const hasImages = files && files.length > 0 && files.some(f => f.type.startsWith('image/'));
    let activeModel = model;
    let switchedFrom: string | null = null;

    if (hasImages && !isMultimodalModel(model)) {
      switchedFrom = model;
      const target = getMultimodalModel();
      activeModel = target.id;
      onModelChange?.(activeModel);
    }

    const now = Date.now();

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      files,
      model: activeModel,
      timestamp: new Date(now),
      conversationId,
    };

    const systemMsg: Message | null = switchedFrom ? {
      id: crypto.randomUUID(),
      role: 'system',
      content: `✨ Model beralih ke ${getModelById(activeModel)?.name || activeModel} untuk mendukung gambar.`,
      model: activeModel,
      timestamp: new Date(now + 1),
      conversationId,
    } : null;

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      model: activeModel,
      timestamp: new Date(now + (systemMsg ? 2 : 1)),
      conversationId,
    };

    // Store refs for callbacks
    currentAssistantContentRef.current = '';
    currentUserMsgRef.current = userMsg;
    currentAssistantMsgRef.current = assistantMsg;
    currentSystemMsgRef.current = systemMsg;
    currentConversationIdRef.current = conversationId;
    tokenBufferRef.current = '';
    reasoningBufferRef.current = '';
    if (pendingFlushRef.current) {
      cancelAnimationFrame(pendingFlushRef.current);
      pendingFlushRef.current = null;
    }

    // Add messages to state
    setMessages(prev => {
      const updated = [...prev, userMsg];
      if (systemMsg) updated.push(systemMsg);
      updated.push(assistantMsg);
      return updated;
    });

    setIsStreaming(true);
    setStreamingMessageId(assistantMsg.id);

    // Build API messages
    const apiMessages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: sandboxMode ? ARTIFACT_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT,
      },
    ];

    if (files && files.length > 0) {
      console.log('[useChat] Files received:', files.length, files.map(f => ({name: f.name, hasContent: !!f.content, contentLen: f.content?.length})));
      const textFiles = files.filter(f => f.content);
      console.log('[useChat] Text files with content:', textFiles.length);
    }

    const historyMessages = messages
      .filter(m => m.conversationId === conversationId)
      .slice(-10)
      .map(m => ({
        role: m.role,
        content: m.content,
      }));
    apiMessages.push(...historyMessages);

    let userContent = content;
    if (files && files.length > 0) {
      const textFiles = files.filter(f => f.content);
      if (textFiles.length > 0) {
        // Include file content directly in the user message
        const fileContent = textFiles
          .map(f => `[File: ${f.name}]\n${f.content}`)
          .join('\n\n');
        userContent = `Berikut file yang saya lampirkan:\n\n${fileContent}\n\n---\nPertanyaan saya: ${content}`;
        console.log('[useChat] Combined message length:', userContent.length);
      } else {
        const imageCount = files.filter(f => f.type.startsWith('image/')).length;
        const fileCount = files.filter(f => !f.type.startsWith('image/')).length;
        const parts = [];
        if (imageCount > 0) parts.push(`${imageCount} gambar`);
        if (fileCount > 0) parts.push(`${fileCount} file`);
        userContent = `${content}\n\n[Lampiran: ${parts.join(', ')}]`;
      }
    }

    const imageDatas = files
      ?.filter(f => f.type.startsWith('image/'))
      .map(f => f.preview);

    let finalUserMessage: { role: string; content: string };
    if (imageDatas && imageDatas.length > 0 && isMultimodalModel(activeModel)) {
      const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: userContent },
      ];
      imageDatas.forEach(dataUrl => {
        contentParts.push({ type: 'image_url', image_url: { url: dataUrl } });
      });
      finalUserMessage = { role: 'user', content: JSON.stringify(contentParts) };
    } else {
      const isContinuing = userContent.trim().toLowerCase().match(/^(lanjut|lanjutkan|sambung|continue)(\s.*)?$/);
      finalUserMessage = {
        role: 'user',
        content: isContinuing
          ? `${userContent}\n\n[INSTRUKSI SISTEM: Lanjutkan respons kamu sebelumnya TEPAT dari karakter atau baris terakhir yang terpotong. JANGAN mengulang kode atau penjelasan dari awal. Langsung sambung saja.]`
          : userContent
      };
    }

    apiMessages.push(finalUserMessage);

    // Send to worker for streaming (runs in background thread)
    worker.postMessage({
      type: 'stream',
      messages: apiMessages,
      model: activeModel,
      apiBase: '/api',
    });
  }, [model, messages, sandboxMode, onModelChange]);

  const stopStreaming = useCallback(() => {
    const worker = workerRef.current;
    if (worker) {
      worker.postMessage({ type: 'cancel' });
    }
    // Flush remaining tokens
    if (tokenBufferRef.current) {
      const batch = tokenBufferRef.current;
      tokenBufferRef.current = '';
      currentAssistantContentRef.current += batch;
      const assistantId = currentAssistantMsgRef.current?.id;
      if (assistantId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + batch } : m
          )
        );
      }
    }
    if (pendingFlushRef.current) {
      cancelAnimationFrame(pendingFlushRef.current);
      pendingFlushRef.current = null;
    }
    setIsStreaming(false);
    setIsReasoning(false);
    setStreamingMessageId(null);
  }, []);

  const retryLastMessage = useCallback(() => {
    if (isStreaming) return;

    // Find the last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // Find and remove the error message
    const lastErrorMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.isError);
    if (lastErrorMsg) {
      setMessages(prev => prev.filter(m => m.id !== lastErrorMsg.id));
    }

    // Resend the last user message
    sendMessage(lastUserMsg.content, lastUserMsg.files, lastUserMsg.conversationId);
  }, [isStreaming, messages, sendMessage]);

  const continuePartialArtifact = useCallback(() => {
    if (isStreaming) return;

    // Find the last assistant message with partial artifact
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && !m.isError);
    if (!lastAssistantMsg) return;

    const conversationId = lastAssistantMsg.conversationId;

    // Remove the partial artifact message from state
    setMessages(prev => prev.filter(m => m.id !== lastAssistantMsg.id));

    // Send a new message that tells AI to continue the partial code
    // Include the partial code as context
    const partialCode = lastAssistantMsg.content;
    const continueContent = `Lanjutkan pembuatan website dari kode sebelumnya yang terpotong. Berikut kode yang sudah ada:\n\n${partialCode}\n\nLanjutkan dari bagian terakhir yang terpotong. JANGAN mengulang dari awal. Tulis SELURUH kode lengkap dari awal sampai akhir dalam satu artifact block.`;
    
    sendMessage(continueContent, undefined, conversationId);
  }, [isStreaming, messages, sendMessage]);

  return { sendMessage, retryLastMessage, continuePartialArtifact, stopStreaming, isStreaming, isReasoning, streamingMessageId, messages, setMessages };
}
