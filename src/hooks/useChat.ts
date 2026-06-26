import { useState, useCallback, useEffect, useRef } from 'react';
import { isMultimodalModel, getMultimodalModel, getModelById } from '../lib/ai/models';
import type { Message, AttachedFile } from '../components/layout/AppShell';
import { saveMessages } from '../services/chat';

interface UseChatOptions {
  model: string;
  userId?: string;
  onModelChange?: (model: string) => void;
}

interface UseChatReturn {
  sendMessage: (content: string, files?: AttachedFile[], conversationId?: string) => void;
  isStreaming: boolean;
  streamingMessageId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

// Web Worker for streaming — imported as URL for React compatibility
const workerUrl = new URL('../lib/ai/streamWorker.ts', import.meta.url);

export function useChat({ model, userId, onModelChange }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  const workerRef = useRef<Worker | null>(null);
  const currentAssistantContentRef = useRef('');
  const currentUserMsgRef = useRef<Message | null>(null);
  const currentAssistantMsgRef = useRef<Message | null>(null);
  const currentSystemMsgRef = useRef<Message | null>(null);
  const currentConversationIdRef = useRef<string | undefined>(undefined);
  const tokenBufferRef = useRef('');
  const pendingFlushRef = useRef<number | null>(null);

  // Create and setup worker
  useEffect(() => {
    const worker = new Worker(workerUrl, { type: 'module' });
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

    const getFriendlyError = (error: string): string => {
      if (error.includes('503') || error.includes('502') || error.includes('504') || error.includes('timeout')) {
        return '⚠️ Model sedang sibuk atau respons terlalu lama (timeout). Silakan ganti ke model Luma untuk sementara waktu.';
      } else if (error.includes('401') || error.includes('provider')) {
        return '⚠️ Saat ini model sedang tidak tersedia. Sangat disarankan untuk mencoba model Luma.';
      } else if (error.includes('429') || error.includes('rate')) {
        return '⚠️ Terlalu banyak permintaan ke model ini. Silakan ganti model atau coba lagi sebentar.';
      } else if (error.includes('network') || error.includes('fetch') || error.includes('Failed')) {
        return '⚠️ Koneksi terputus. Pastikan internet Anda stabil.';
      }
      return '⚠️ Maaf, terjadi gangguan pada sistem AI. Silakan coba lagi nanti.';
    };

    const handleDone = () => {
      // Flush any remaining tokens
      flushTokens();
      if (pendingFlushRef.current) {
        cancelAnimationFrame(pendingFlushRef.current);
        pendingFlushRef.current = null;
      }

      setIsStreaming(false);
      setStreamingMessageId(null);

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
      console.error('Chat Error:', error);
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
              ? { ...m, content: friendlyError }
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
        // Batch tokens for smooth rendering
        tokenBufferRef.current += msg.data;
        if (!pendingFlushRef.current) {
          pendingFlushRef.current = requestAnimationFrame(flushTokens);
        }
      } else if (msg.type === 'done') {
        handleDone();
      } else if (msg.type === 'error') {
        handleError(msg.data);
      }
    };

    worker.onerror = (e) => {
      handleError(e.message);
    };

    // Flush tokens when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && tokenBufferRef.current) {
        flushTokens();
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

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      files,
      model: activeModel,
      timestamp: new Date(),
      conversationId,
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      model: activeModel,
      timestamp: new Date(),
      conversationId,
    };

    const systemMsg: Message | null = switchedFrom ? {
      id: crypto.randomUUID(),
      role: 'system',
      content: `✨ Model beralih ke ${getModelById(activeModel)?.name || activeModel} untuk mendukung gambar.`,
      model: activeModel,
      timestamp: new Date(),
      conversationId,
    } : null;

    // Store refs for callbacks
    currentAssistantContentRef.current = '';
    currentUserMsgRef.current = userMsg;
    currentAssistantMsgRef.current = assistantMsg;
    currentSystemMsgRef.current = systemMsg;
    currentConversationIdRef.current = conversationId;
    tokenBufferRef.current = '';
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
        content: 'Kamu adalah Lyra, AI assistant yang cerdas dan membantu. Jawab dalam Bahasa Indonesia kecuali diminta bahasa lain. Gunakan format markdown jika diperlukan.\nATURAN KODE: Jika membuat kode yang sangat panjang (seperti file HTML + CSS + JS sekaligus), PECAH menjadi beberapa bagian. Berikan satu bagian dulu, lalu tanyakan apakah user ingin melanjutkan ke bagian berikutnya. JANGAN memberikan kode raksasa dalam satu balasan.',
      },
    ];

    if (files && files.length > 0) {
      const textFiles = files.filter(f => f.content);
      if (textFiles.length > 0) {
        const fileContext = textFiles
          .map(f => `[File: ${f.name}]\n${f.content}`)
          .join('\n\n');
        apiMessages.push({
          role: 'user',
          content: `Berikut file yang saya lampirkan:\n\n${fileContext}`,
        });
      }
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
      const imageCount = files.filter(f => f.type.startsWith('image/')).length;
      const fileCount = files.filter(f => !f.type.startsWith('image/')).length;
      const parts = [];
      if (imageCount > 0) parts.push(`${imageCount} gambar`);
      if (fileCount > 0) parts.push(`${fileCount} file`);
      userContent = `${content}\n\n[Lampiran: ${parts.join(', ')}]`;
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
  }, [model, messages, onModelChange]);

  return { sendMessage, isStreaming, streamingMessageId, messages, setMessages };
}
