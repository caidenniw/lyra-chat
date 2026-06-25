import { useState, useCallback } from 'react';
import { streamChat, type ChatMessage } from '../lib/ai/client';
import { isMultimodalModel, getMultimodalModel, getModelById } from '../lib/ai/models';
import type { Message, AttachedFile } from '../components/layout/AppShell';

interface UseChatOptions {
  model: string;
  onModelChange?: (model: string) => void;
}

interface UseChatReturn {
  sendMessage: (content: string, files?: AttachedFile[], conversationId?: string) => Promise<void>;
  isStreaming: boolean;
  streamingMessageId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useChat({ model, onModelChange }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string, files?: AttachedFile[], conversationId?: string) => {
    const hasImages = files && files.length > 0 && files.some(f => f.type.startsWith('image/'));
    let activeModel = model;
    let switchedFrom: string | null = null;

    // Auto-switch to multimodal if images but current model can't handle them
    if (hasImages && !isMultimodalModel(model)) {
      switchedFrom = model;
      const target = getMultimodalModel();
      activeModel = target.id;
      onModelChange?.(activeModel);
    }

    // User message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      files,
      timestamp: new Date(),
      conversationId,
    };

    // Assistant placeholder
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      conversationId,
    };

    // System warning message (if model was switched)
    const systemMsg: Message | null = switchedFrom ? {
      id: crypto.randomUUID(),
      role: 'system',
      content: `✨ Model beralih ke ${getModelById(activeModel)?.name || activeModel} untuk mendukung gambar.`,
      timestamp: new Date(),
      conversationId,
    } : null;

    // Add messages: user → system warning (if any) → assistant placeholder
    setMessages(prev => {
      const updated = [...prev, userMsg];
      if (systemMsg) updated.push(systemMsg);
      updated.push(assistantMsg);
      return updated;
    });

    setIsStreaming(true);
    setStreamingMessageId(assistantMsg.id);

    // Build API messages
    const apiMessages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Kamu adalah Lyra, AI assistant yang cerdas dan membantu. Jawab dalam Bahasa Indonesia kecuali diminta bahasa lain. Gunakan format markdown jika diperlukan.\nATURAN KODE: Jika membuat kode yang sangat panjang (seperti file HTML + CSS + JS sekaligus), PECAH menjadi beberapa bagian. Berikan satu bagian dulu, lalu tanyakan apakah user ingin melanjutkan ke bagian berikutnya. JANGAN memberikan kode raksasa dalam satu balasan.',
      },
    ];

    // Add file content as text context (non-image files)
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

    // Conversation history
    const historyMessages = messages
      .filter(m => m.conversationId === conversationId)
      .slice(-20)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    apiMessages.push(...historyMessages);

    // Build user message with file context
    let userContent = content;
    if (files && files.length > 0) {
      const imageCount = files.filter(f => f.type.startsWith('image/')).length;
      const fileCount = files.filter(f => !f.type.startsWith('image/')).length;
      const parts = [];
      if (imageCount > 0) parts.push(`${imageCount} gambar`);
      if (fileCount > 0) parts.push(`${fileCount} file`);
      userContent = `${content}\n\n[Lampiran: ${parts.join(', ')}]`;
    }

    // Collect image data
    const imageDatas = files
      ?.filter(f => f.type.startsWith('image/'))
      .map(f => f.preview);

    // Build final user message (multimodal or text)
    let finalUserMessage: ChatMessage;
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

    try {
      await streamChat(apiMessages, activeModel, {
        onToken: (token) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + token }
                : m
            )
          );
        },
        onDone: () => {
          setIsStreaming(false);
          setStreamingMessageId(null);
        },
        onError: (error) => {
          console.error("Chat Error:", error);
          // Graceful error messages
          let friendlyError = '⚠️ Maaf, terjadi gangguan pada sistem AI. Silakan coba lagi nanti.';
          
          if (error.includes('503') || error.includes('502') || error.includes('504') || error.includes('timeout')) {
            friendlyError = '⚠️ Model sedang sibuk atau respons terlalu lama (timeout). Silakan ganti ke model Luma untuk sementara waktu.';
          } else if (error.includes('401') || error.includes('provider')) {
            friendlyError = '⚠️ Saat ini model sedang tidak tersedia. Sangat disarankan untuk mencoba model Luma.';
          } else if (error.includes('429') || error.includes('rate')) {
            friendlyError = '⚠️ Terlalu banyak permintaan ke model ini. Silakan ganti model atau coba lagi sebentar.';
          } else if (error.includes('network') || error.includes('fetch') || error.includes('Failed')) {
            friendlyError = '⚠️ Koneksi terputus. Pastikan internet Anda stabil.';
          } 

          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? { ...m, content: friendlyError }
                : m
            )
          );
          setIsStreaming(false);
          setStreamingMessageId(null);
        },
      });
    } catch (error) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: '⚠️ Gagal mengirim pesan. Periksa koneksi internet.' }
            : m
        )
      );
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  }, [model, messages, onModelChange]);

  return { sendMessage, isStreaming, streamingMessageId, messages, setMessages };
}
