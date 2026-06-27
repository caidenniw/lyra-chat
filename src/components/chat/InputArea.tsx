import { Send, Paperclip, Square, X, FileText, ChevronDown, Check, Star } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AttachedFile } from "../layout/AppShell";
import { MODELS } from "../../lib/ai/models";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// Configure PDF.js — run on main thread (reliable, no worker issues)
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

interface InputAreaProps {
  onSend: (content: string, files?: AttachedFile[]) => void;
  hasMessages?: boolean;
  isStreaming?: boolean;
  isReasoning?: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const textParts: string[] = [];

    // Limit to first 20 pages to avoid huge payloads
    const pagesToRead = Math.min(totalPages, 20);
    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      if (pageText.trim()) {
        textParts.push(`[Halaman ${i}]\n${pageText}`);
      }
    }

    if (totalPages > 20) {
      textParts.push(`\n[... ${totalPages - 20} halaman lagi tidak ditampilkan]`);
    }

    const result = textParts.join("\n\n");
    if (!result.trim()) {
      return "[PDF ini sepertinya scanned image — tidak ada teks yang bisa diekstrak]";
    }
    return result;
  } catch (err) {
    console.error("PDF extraction error:", err);
    return `[Gagal membaca PDF: ${err instanceof Error ? err.message : "unknown error"}]`;
  }
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function isImageFile(type: string): boolean {
  return type.startsWith("image/");
}

function isPdfFile(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isDocxFile(name: string): boolean {
  return name.toLowerCase().endsWith(".docx");
}

function isTextFile(name: string): boolean {
  const textExtensions = [
    ".txt",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".java",
    ".cpp",
    ".c",
    ".h",
    ".cs",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".swift",
    ".kt",
    ".scala",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".xml",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".sql",
    ".sh",
    ".bash",
    ".zsh",
    ".ps1",
    ".bat",
    ".cmd",
    ".md",
    ".markdown",
    ".csv",
    ".log",
    ".ini",
    ".cfg",
    ".conf",
    ".env",
    ".gitignore",
    ".dockerfile",
    ".vue",
    ".svelte",
    ".r",
    ".m",
    ".lua",
    ".dart",
    ".ex",
    ".exs",
    ".hs",
    ".ml",
  ];
  const ext = "." + name.split(".").pop()?.toLowerCase();
  return textExtensions.includes(ext);
}

export function InputArea({ onSend, isStreaming = false, isReasoning = false, selectedModel, onModelChange }: InputAreaProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModelPickerOpen(false);
    };
    if (modelPickerOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [modelPickerOpen]);

  const addFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const remaining = MAX_FILES - files.length;
      const toProcess = fileArray.slice(0, remaining);

      const processed: AttachedFile[] = [];
      for (const file of toProcess) {
        if (file.size > MAX_FILE_SIZE) {
          alert(`${file.name} terlalu besar (maks 10MB)`);
          continue;
        }
        try {
          if (isImageFile(file.type)) {
            const dataUrl = await readFileAsDataURL(file);
            processed.push({ name: file.name, type: file.type, size: file.size, preview: dataUrl });
          } else if (isPdfFile(file.name)) {
            const text = await extractPdfText(file);
            const preview = text.slice(0, 200) + (text.length > 200 ? "..." : "");
            processed.push({ name: file.name, type: file.type, size: file.size, preview, content: text });
          } else if (isDocxFile(file.name)) {
            const text = await extractDocxText(file);
            const preview = text.slice(0, 200) + (text.length > 200 ? "..." : "");
            processed.push({ name: file.name, type: file.type, size: file.size, preview, content: text });
          } else if (isTextFile(file.name)) {
            const text = await readFileAsText(file);
            const preview = text.slice(0, 200) + (text.length > 200 ? "..." : "");
            processed.push({ name: file.name, type: file.type, size: file.size, preview, content: text });
          } else {
            alert(`${file.name} tidak didukung. Format yang bisa dibaca: gambar, PDF, Word (.docx), dan file teks.`);
          }
        } catch (err) {
          console.error("File read error:", err);
          alert(`Gagal membaca ${file.name}`);
        }
      }
      setFiles((prev) => [...prev, ...processed].slice(0, MAX_FILES));
    },
    [files.length],
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if ((!input.trim() && files.length === 0) || isStreaming) return;
    onSend(input.trim() || "(File attached)", files.length > 0 ? files : undefined);
    setInput("");
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="relative bg-bg md:bg-transparent pb-5 md:pb-8 border-t md:border-t-0 border-border/30 md:border-0">
      <div className="max-w-3xl mx-auto px-3 md:px-8 pt-2 md:pt-2 pb-1 md:pb-2">
        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-3 mb-2 px-3 py-2 rounded-xl bg-primary-subtle border border-primary/10 animate-message-in">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs font-medium text-primary">
              {isReasoning ? 'Lyra sedang berpikir...' : 'Lyra sedang menjawab...'}
            </span>
          </div>
        )}

        {/* File preview strip */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((file, idx) => (
              <div key={idx} className="relative group flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-xl bg-surface border border-border shadow-soft animate-message-in">
                {isImageFile(file.type) ? (
                  <img src={file.preview} alt={file.name} className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText size={16} className="text-primary md:hidden" />
                    <FileText size={18} className="text-primary hidden md:block" />
                  </div>
                )}
                <div className="max-w-[80px] md:max-w-[100px]">
                  <div className="text-[10px] md:text-xs font-medium text-text truncate">{file.name}</div>
                  <div className="text-[9px] md:text-[10px] text-text-dim">{formatSize(file.size)}</div>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-white
                    flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity btn-press"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ===== Input Box — Claude/GPT style ===== */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex items-center gap-2 md:gap-3 bg-surface border border-border rounded-2xl md:rounded-3xl
            px-3 py-1.5 md:px-4 md:py-2.5 mx-0 md:mx-4
            input-focus-ring transition-all duration-300
            ${dragOver ? 'border-primary ring-2 ring-primary/20' : isStreaming ? 'border-primary/30' : 'focus-within:border-primary/30'}`}
        >
          {/* Attachment */}
          <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 text-text-dim hover:text-primary transition-colors btn-press">
            <Paperclip size={18} className="md:hidden" />
            <Paperclip size={20} className="hidden md:block" />
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} accept="*/*" />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Lyra sedang menjawab...' : 'Ketik pesan...'}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-text text-sm md:text-[15px] placeholder:text-text-dim
              resize-none outline-none max-h-[200px] leading-normal disabled:opacity-50"
          />

          {/* Send / Stop */}
          {isStreaming ? (
            <button className="flex-shrink-0 p-2 rounded-full bg-accent text-white btn-press" title="Hentikan">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!input.trim() && files.length === 0}
              className={`flex-shrink-0 p-2 rounded-full transition-all btn-press
                ${input.trim() || files.length > 0 ? 'bg-primary text-white hover:bg-primary-hover' : 'text-text-dim'}`}>
              <Send size={14} />
            </button>
          )}
        </div>

        {/* ===== Model Selector — below input, Claude style ===== */}
        <div className="flex justify-center mt-2">
          <button onClick={() => setModelPickerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border
              text-text-dim hover:text-text hover:border-primary/20 transition-all text-xs font-medium btn-press">
            {currentModel.name}
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Model Picker — framer-motion modal */}
        <AnimatePresence>
          {modelPickerOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={() => setModelPickerOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="relative w-full max-w-md mx-4 bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
                  <h3 className="text-base font-semibold text-text">Pilih model</h3>
                  <button onClick={() => setModelPickerOpen(false)} className="text-text-dim hover:text-text text-lg leading-none btn-press">✕</button>
              </div>
              <div className="p-3 space-y-1.5">
                {MODELS.map((model) => (
                  <button key={model.id} onClick={() => { onModelChange(model.id); setModelPickerOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left btn-press
                      ${selectedModel === model.id ? 'bg-primary-subtle border border-primary/20' : 'hover:bg-bg-alt border border-transparent'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      ${selectedModel === model.id ? 'border-primary bg-primary' : 'border-border-light'}`}>
                      {selectedModel === model.id && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-semibold text-sm ${selectedModel === model.id ? 'text-primary' : 'text-text'}`}>{model.name}</span>
                        {model.badge === 'recommended' && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 font-semibold">
                            <Star size={10} className="fill-amber-400" />Rekomendasi
                          </span>
                        )}
                        {model.multimodal && <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent-subtle text-accent font-medium">Multimodal</span>}
                        {model.reasoning && <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary-subtle text-primary font-medium">Reasoning</span>}
                      </div>
                      <span className="text-xs text-text-dim">{model.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
