import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { X, Monitor, Tablet, Smartphone, Code2, Copy, Check, RotateCcw, FileArchive, Maximize2, Minimize2, AlertTriangle, Wrench, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import type { ArtifactBlock, ArtifactFile } from '../../lib/artifact/extractor';
import { normalizeFilePath } from '../../lib/artifact/extractor';
import { buildPageHtml, listHtmlPages, resolveExistingPath, resolvePreviewPath } from '../../lib/artifact/preview';
import { FileTree } from './FileTree';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

interface PreviewError {
  message: string;
  source?: string;
  line?: number;
}

interface ArtifactPreviewProps {
  artifact: ArtifactBlock;
  onClose: () => void;
  /** Sends an auto-composed "fix this error" message to the AI */
  onFixError?: (text: string) => void;
  /** True while the AI is still writing the artifact — preview updates live (throttled) */
  isStreaming?: boolean;
}

export function ArtifactPreview({ artifact, onClose, onFixError, isStreaming = false }: ArtifactPreviewProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [showCode, setShowCode] = useState(false);
  const [fullCode, setFullCode] = useState(false);
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const isDragging = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const files = useMemo<ArtifactFile[]>(
    () => (artifact.files && artifact.files.length > 0 ? artifact.files : [{ path: 'index.html', content: artifact.code }]),
    [artifact],
  );
  const filesRef = useRef(files);
  filesRef.current = files;

  // Live preview: while streaming, refresh the preview at most every 700ms
  // to avoid reloading the iframe on every token.
  const [previewFiles, setPreviewFiles] = useState(files);
  const throttleRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isStreaming) {
      if (throttleRef.current !== null) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
      setPreviewFiles(files);
      return;
    }
    if (throttleRef.current === null) {
      throttleRef.current = window.setTimeout(() => {
        throttleRef.current = null;
        setPreviewFiles(filesRef.current);
      }, 700);
    }
  }, [files, isStreaming]);
  useEffect(() => () => {
    if (throttleRef.current !== null) clearTimeout(throttleRef.current);
  }, []);

  // Multi-page navigation
  const pages = useMemo(() => listHtmlPages(previewFiles), [previewFiles]);
  const [activePage, setActivePage] = useState('index.html');
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;
  useEffect(() => {
    if (pages.length > 0 && !pages.includes(activePage)) {
      setActivePage(pages[0]);
    }
  }, [pages, activePage]);

  const [refreshKey, setRefreshKey] = useState(0);
  const pageHtml = useMemo(() => buildPageHtml(previewFiles, activePage), [previewFiles, activePage]);

  // Runtime errors reported by the preview iframe
  const [errors, setErrors] = useState<PreviewError[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    setErrors([]);
  }, [pageHtml, refreshKey]);

  // Navigation toast: missing target page, or blocked programmatic navigation
  const [toast, setToast] = useState<{ kind: 'missing-page'; path: string } | { kind: 'nav-blocked' } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Hijack detection: our runtime pings "ready" as soon as the srcdoc page
  // runs. If the iframe fires load without that ping, generated JS navigated
  // away (location.href etc.) — restore the srcdoc page. Restores are
  // time-throttled (never capped) so the preview can never stay blank.
  const readyRef = useRef(false);
  const lastRestoreRef = useRef(0);
  useEffect(() => {
    readyRef.current = false;
  }, [pageHtml, refreshKey]);

  const handleIframeLoad = useCallback(() => {
    window.setTimeout(() => {
      if (readyRef.current) return;
      // Throttle by delaying (never skipping) so the preview always recovers
      const wait = Math.max(0, 1000 - (Date.now() - lastRestoreRef.current));
      window.setTimeout(() => {
        if (readyRef.current) return;
        lastRestoreRef.current = Date.now();
        setToast({ kind: 'nav-blocked' });
        setRefreshKey(k => k + 1);
      }, wait);
    }, 250);
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.__lyra !== true) return;
      // Two ArtifactPreview instances can be mounted (desktop + mobile) — only
      // react to messages from our own iframe.
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;

      if (d.type === 'ready') {
        readyRef.current = true;
      } else if (d.type === 'navigate' && typeof d.path === 'string') {
        const paths = filesRef.current.map(f => normalizeFilePath(f.path));
        const existing = resolveExistingPath(paths, activePageRef.current, d.path);
        if (existing) {
          setActivePage(existing);
          setToast(null);
        } else {
          const strict = resolvePreviewPath(activePageRef.current, d.path);
          setToast({ kind: 'missing-page', path: strict || d.path });
        }
      } else if (d.type === 'error' || d.type === 'console-error') {
        const message = typeof d.message === 'string' ? d.message : String(d.message);
        setErrors(prev => {
          if (prev.length >= 20 || prev.some(p => p.message === message)) return prev;
          return [...prev, { message, source: d.source, line: d.line }];
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleFixError = useCallback(() => {
    if (!onFixError || errors.length === 0) return;
    const list = errors
      .map(err => `- ${err.message}${err.line ? ` (baris ${err.line})` : ''}`)
      .join('\n');
    onFixError(`Preview website di halaman "${activePageRef.current}" menampilkan error berikut:\n${list}\n\nTolong perbaiki error tersebut. Keluarkan hanya file yang perlu diubah.`);
    setShowErrors(false);
  }, [onFixError, errors]);

  const handleCopy = useCallback(async () => {
    const fileContent = files[activeFile]?.content || artifact.code;
    await navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [files, activeFile, artifact.code]);

  const handleDownloadZip = useCallback(async () => {
    const zip = new JSZip();
    const folderName = (artifact.title || 'website').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const folder = zip.folder(folderName);

    for (const file of files) {
      folder?.file(file.path, file.content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [files, artifact.title]);

  // Highlight.js: auto-detect language from current file
  const highlightedCode = useMemo(() => {
    const code = files[activeFile]?.content || artifact.code || '';
    if (!code.trim()) return '';
    try {
      const langMap: Record<string, string> = {
        html: 'html', htm: 'html',
        css: 'css', scss: 'css', less: 'css',
        js: 'javascript', mjs: 'javascript',
        ts: 'typescript', tsx: 'typescript',
        jsx: 'javascript',
        json: 'json',
        svg: 'xml', xml: 'xml',
        md: 'markdown',
        txt: 'plaintext',
      };
      const ext = files[activeFile]?.path?.split('.').pop()?.toLowerCase() || '';
      const lang = langMap[ext] || '';
      if (lang) {
        const result = hljs.highlight(code, { language: lang });
        if (result && result.value) return result.value;
      }
      const autoResult = hljs.highlightAuto(code);
      return autoResult.value;
    } catch {
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [files, activeFile, artifact.code]);

  useEffect(() => {
    document.querySelectorAll('.hljs code').forEach(block => {
      hljs.highlightElement(block as HTMLElement);
    });
  }, [activeFile]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Current file name for display
  const currentFileName = files[activeFile]?.path?.split('/').pop() || 'index.html';

  // Check if file is currently copied
  const isCurrentlySelected = (idx: number) => activeFile === idx;

  const previewFrame = (
    <iframe
      key={refreshKey}
      ref={iframeRef}
      srcDoc={pageHtml}
      onLoad={handleIframeLoad}
      title={artifact.title || 'Website Preview'}
      sandbox="allow-scripts"
      className="w-full h-full border-0"
      style={{ minHeight: '100%' }}
    />
  );

  // A missing target whose basename exists elsewhere means the LINK is wrong,
  // not that a page is missing — ask the AI to fix the href, never to create
  // files at nonsense paths like pages/pages/.
  const missingCandidates = toast?.kind === 'missing-page'
    ? files.filter(f => f.path.split('/').pop() === toast.path.split('/').pop()).map(f => normalizeFilePath(f.path))
    : [];

  const navToast = toast && (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border shadow-medium text-xs text-text animate-fade-in max-w-[90%]">
      {toast.kind === 'missing-page' ? (
        <>
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <span className="truncate">
            {missingCandidates.length > 0
              ? <>Link salah path: <span className="font-mono font-medium">{toast.path}</span></>
              : <>Halaman <span className="font-mono font-medium">{toast.path}</span> belum dibuat</>}
          </span>
          {onFixError && (
            <button
              onClick={() => {
                if (missingCandidates.length > 0) {
                  onFixError(`Link navigasi di halaman "${activePageRef.current}" salah path: menunjuk ke "${toast.path}" padahal file yang benar adalah "${missingCandidates[0]}". PERBAIKI href link tersebut di file yang bersangkutan (action="update"). JANGAN membuat file atau folder baru — cukup betulkan path href-nya, dan periksa link nav lain yang salah dengan pola yang sama.`);
                } else {
                  onFixError(`Link navigasi menunjuk ke halaman "${toast.path}" tapi file-nya belum ada. Buatkan halaman "${toast.path}" secara lengkap (action="update"), konsisten dengan desain dan navigasi halaman lain.`);
                }
                setToast(null);
              }}
              className="shrink-0 px-2 py-1 rounded-lg bg-primary text-white text-[11px] font-medium hover:bg-primary/90 transition-colors btn-press"
            >
              {missingCandidates.length > 0 ? 'Minta Lyra perbaiki link' : 'Minta Lyra buatkan'}
            </button>
          )}
        </>
      ) : (
        <>
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <span>Navigasi diblokir & halaman dipulihkan — minta Lyra pakai link &lt;a href&gt; untuk pindah halaman</span>
        </>
      )}
      <button onClick={() => setToast(null)} className="shrink-0 p-0.5 rounded text-text-dim hover:text-text transition-colors">
        <X size={12} />
      </button>
    </div>
  );

  const errorBadge = errors.length > 0 && (
    <button
      onClick={() => setShowErrors(v => !v)}
      title={`${errors.length} error di preview`}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors btn-press ${
        showErrors ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
      }`}
    >
      <AlertTriangle size={12} />
      <span>{errors.length}</span>
    </button>
  );

  return (
    <div className="relative flex flex-col h-full bg-bg border-l border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-1">
          {showCode && (
            <button
              onClick={() => setFullCode(!fullCode)}
              title={fullCode ? 'Show preview' : 'Full code mode'}
              className={`p-1.5 rounded-lg transition-colors ${
                fullCode ? 'bg-primary/10 text-primary' : 'text-text-dim hover:text-text hover:bg-bg-alt'
              }`}
            >
              {fullCode ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          )}
          {!fullCode && (
            <>
              <DeviceButton icon={Monitor} mode="desktop" active={device} onClick={setDevice} label="Desktop" />
              <DeviceButton icon={Tablet} mode="tablet" active={device} onClick={setDevice} label="Tablet" />
              <DeviceButton icon={Smartphone} mode="mobile" active={device} onClick={setDevice} label="Mobile" />
            </>
          )}
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => setShowCode(!showCode)}
            title={showCode ? 'Preview' : 'Source code'}
            className={`p-1.5 rounded-lg transition-colors ${
              showCode ? 'bg-primary text-white' : 'text-text-dim hover:text-text hover:bg-bg-alt'
            }`}
          >
            <Code2 size={14} />
          </button>
          {/* Page selector — multi-page projects */}
          {!fullCode && pages.length > 1 && (
            <select
              value={activePage}
              onChange={e => setActivePage(e.target.value)}
              title="Pilih halaman"
              className="ml-1 max-w-[130px] text-[11px] px-1.5 py-1 rounded-lg bg-bg-alt border border-border text-text-muted hover:text-text cursor-pointer"
            >
              {pages.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          {isStreaming && (
            <span className="ml-1 flex items-center gap-1 text-[11px] text-primary">
              <Loader2 size={12} className="animate-spin" />
              <span className="hidden sm:inline">Menulis kode...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {errorBadge}
          <span className="text-[11px] text-text-dim mx-2 hidden sm:block truncate max-w-[140px]">
            {showCode ? currentFileName : (artifact.title || 'Preview')}
          </span>
          <button onClick={handleRefresh} title="Refresh" className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors">
            <RotateCcw size={13} />
          </button>
          <button onClick={handleDownloadZip} title="Download ZIP" className="p-1.5 rounded-lg text-text-dim hover:text-primary hover:bg-primary/5 transition-colors">
            <FileArchive size={13} />
          </button>
          <button onClick={handleCopy} title="Copy code" className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors">
            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          </button>
          <button onClick={onClose} title="Tutup preview" className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors ml-1">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Content: Split View (Code + Preview) or Full Preview */}
      {showCode && fullCode ? (
        /* Full Code Mode (like before — file tree + editor, no preview) */
        <div className="flex-1 flex overflow-hidden">
          <FileTree
            files={files}
            activeFile={activeFile}
            onFileSelect={setActiveFile}
          />
          <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e2e]">
            <div className="flex items-center gap-0 px-1 pt-0 overflow-x-auto flex-shrink-0 bg-[#1e1e2e] border-b border-[#313244]">
              {files.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveFile(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
                    isCurrentlySelected(idx)
                      ? 'text-[#cdd6f4] border-[#cba6f7] bg-[#313244]/50'
                      : 'text-[#6c7086] border-transparent hover:text-[#a6adc8] hover:bg-[#313244]/30'
                  }`}
                >
                  <FileIcon path={file.path} />
                  <span>{file.path.split('/').pop()}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words hljs" style={{ background: 'transparent' }}>
                <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedCode || '&nbsp;' }} />
              </pre>
            </div>
          </div>
        </div>
      ) : showCode ? (
        /* Split Mode: Code on left + Preview on right */
        <div className="flex-1 flex overflow-hidden">
          {/* Code side */}
          <div className="flex overflow-hidden" style={{ width: `${splitRatio}%` }}>
            <FileTree
              files={files}
              activeFile={activeFile}
              onFileSelect={setActiveFile}
            />
            <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e2e]">
              <div className="flex items-center gap-0 px-1 pt-0 overflow-x-auto flex-shrink-0 bg-[#1e1e2e] border-b border-[#313244]">
                {files.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveFile(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border-b-2 ${
                      isCurrentlySelected(idx)
                        ? 'text-[#cdd6f4] border-[#cba6f7] bg-[#313244]/50'
                        : 'text-[#6c7086] border-transparent hover:text-[#a6adc8] hover:bg-[#313244]/30'
                    }`}
                  >
                    <FileIcon path={file.path} />
                    <span>{file.path.split('/').pop()}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words hljs" style={{ background: 'transparent' }}>
                  <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedCode || '&nbsp;' }} />
                </pre>
              </div>
            </div>
          </div>

          {/* Resize handle */}
          <div
            className="w-[4px] bg-[#313131] hover:bg-[#cba6f7] hover:w-[4px] cursor-col-resize shrink-0 relative transition-colors group z-10"
            onMouseDown={(e) => {
              isDragging.current = true;
              const startX = e.clientX;
              const startRatio = splitRatio;
              const container = e.currentTarget.parentElement!;
              const containerWidth = container.offsetWidth;

              const handleMouseMove = (me: MouseEvent) => {
                if (!isDragging.current) return;
                const dx = me.clientX - startX;
                const newRatio = Math.min(80, Math.max(20, startRatio + (dx / containerWidth) * 100));
                setSplitRatio(newRatio);
              };
              const handleMouseUp = () => {
                isDragging.current = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="absolute inset-y-0 left-[-2px] right-[-2px] group-hover:bg-[#cba6f7]/20 transition-colors" />
          </div>

          {/* Preview side */}
          <div className="flex-1 flex items-start justify-center p-3 overflow-hidden bg-[#e8e5e0] min-w-0">
            <div
              className="h-full bg-white rounded-xl shadow-medium overflow-hidden transition-all duration-300 ease-out"
              style={{ width: '100%', maxWidth: DEVICE_WIDTHS[device] }}
            >
              {previewFrame}
            </div>
          </div>
        </div>
      ) : (
        /* Preview only (full screen) */
        <div className="flex-1 flex items-start justify-center p-3 overflow-hidden bg-[#e8e5e0]">
          <div
            className="h-full bg-white rounded-xl shadow-medium overflow-hidden transition-all duration-300 ease-out"
            style={{ width: DEVICE_WIDTHS[device], maxWidth: '100%' }}
          >
            {previewFrame}
          </div>
        </div>
      )}

      {navToast}

      {/* Error panel */}
      {showErrors && errors.length > 0 && (
        <div className="flex-shrink-0 border-t border-red-200 bg-red-50 max-h-40 flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] font-semibold text-red-700 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              Error di preview ({errors.length})
            </span>
            {onFixError && (
              <button
                onClick={handleFixError}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-medium hover:bg-red-700 transition-colors btn-press"
              >
                <Wrench size={11} />
                <span>Minta Lyra perbaiki</span>
              </button>
            )}
          </div>
          <div className="overflow-y-auto px-3 pb-2 space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="text-[11px] font-mono text-red-800 break-words">
                {err.message}{err.line ? ` (baris ${err.line})` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileIcon({ path }: { path: string }) {
  const name = path.split('/').pop()?.toLowerCase() || '';
  const ext = name.split('.').pop();

  if (name === 'index.html') return <span className="text-[#e37933] text-[11px]">&#x1F4C4;</span>;
  if (name === 'style.css') return <span className="text-[#519aba] text-[11px]">&#x1F3A8;</span>;
  if (name === 'script.js') return <span className="text-[#cbcb41] text-[11px]">&#x26A1;</span>;

  switch (ext) {
    case 'html': case 'htm': return <span className="text-[#e37933] text-[11px]">&#x1F4C4;</span>;
    case 'css': case 'scss': return <span className="text-[#519aba] text-[11px]">&#x1F3A8;</span>;
    case 'js': case 'jsx': case 'mjs': return <span className="text-[#cbcb41] text-[11px]">&#x26A1;</span>;
    case 'ts': case 'tsx': return <span className="text-[#3178c6] text-[11px]">TS</span>;
    case 'json': return <span className="text-[#cbcb41] text-[11px]">{'{ }'}</span>;
    default: return <span className="text-text-dim text-[11px]">&#x1F4C4;</span>;
  }
}

function DeviceButton({
  icon: Icon,
  mode,
  active,
  onClick,
  label,
}: {
  icon: typeof Monitor;
  mode: DeviceMode;
  active: DeviceMode;
  onClick: (m: DeviceMode) => void;
  label: string;
}) {
  const isActive = active === mode;
  return (
    <button
      onClick={() => onClick(mode)}
      title={label}
      className={`p-1.5 rounded-lg transition-colors ${
        isActive ? 'bg-primary/10 text-primary' : 'text-text-dim hover:text-text hover:bg-bg-alt'
      }`}
    >
      <Icon size={14} />
    </button>
  );
}
