import { useState, useMemo, useRef, useCallback } from 'react';
import { X, Monitor, Tablet, Smartphone, Code2, Copy, Check, RotateCcw, FileArchive } from 'lucide-react';
import JSZip from 'jszip';
import type { ArtifactBlock } from '../../lib/artifact/extractor';
import { buildPreviewHtml, INTERCEPT_SCRIPT } from '../../lib/artifact/extractor';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

interface ArtifactPreviewProps {
  artifact: ArtifactBlock;
  onClose: () => void;
}

export function ArtifactPreview({ artifact, onClose }: ArtifactPreviewProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [showCode, setShowCode] = useState(false);
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const files = artifact.files || [{ path: 'index.html', content: artifact.code }];

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

  const handleRefresh = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      const doc = iframe.srcdoc;
      iframe.srcdoc = '';
      requestAnimationFrame(() => { iframe.srcdoc = doc; });
    }
  }, []);

  // Build combined HTML for preview
  const safeCode = useMemo(() => {
    let code: string;
    if (files.length === 1) {
      // Single file — ensure it's valid HTML
      code = files[0].content;
      if (!code.trim().toLowerCase().startsWith('<!doctype') && !code.trim().toLowerCase().startsWith('<html')) {
        code = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body{margin:0;font-family:system-ui,sans-serif;}</style>
</head>
<body>${code}</body>
</html>`;
      }
    } else {
      code = buildPreviewHtml(files);
    }
    // ALWAYS inject click interceptor before </body>
    if (code.includes('</body>')) {
      code = code.replace('</body>', INTERCEPT_SCRIPT + '\n</body>');
    } else {
      code += '\n' + INTERCEPT_SCRIPT;
    }
    return code;
  }, [files]);

  const getFileIcon = (path: string) => {
    if (path.endsWith('.css')) return '🎨';
    if (path.endsWith('.js')) return '⚡';
    if (path.endsWith('.html')) return '📄';
    return '📝';
  };

  return (
    <div className="flex flex-col h-full bg-bg border-l border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-1">
          <DeviceButton icon={Monitor} mode="desktop" active={device} onClick={setDevice} label="Desktop" />
          <DeviceButton icon={Tablet} mode="tablet" active={device} onClick={setDevice} label="Tablet" />
          <DeviceButton icon={Smartphone} mode="mobile" active={device} onClick={setDevice} label="Mobile" />
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => setShowCode(!showCode)}
            title="Source code"
            className={`p-1.5 rounded-lg transition-colors ${
              showCode ? 'bg-primary text-white' : 'text-text-dim hover:text-text hover:bg-bg-alt'
            }`}
          >
            <Code2 size={14} />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <span className="text-[11px] text-text-dim mr-2 hidden sm:block truncate max-w-[140px]">
            {artifact.title || 'Preview'}
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

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-[#e8e5e0] flex flex-col">
        {showCode ? (
          /* Code View with tabs */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* File tabs */}
            {files.length > 1 && (
              <div className="flex items-center gap-0 px-1 pt-2 pb-0 overflow-x-auto flex-shrink-0">
                {files.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveFile(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                      activeFile === idx
                        ? 'bg-[#1e1e2e] text-[#cdd6f4] border border-[#313244] border-b-transparent -mb-px'
                        : 'bg-[#313244] text-[#6c7086] hover:text-[#a6adc8] border border-transparent'
                    }`}
                  >
                    <span>{getFileIcon(file.path)}</span>
                    <span>{file.path.split('/').pop()}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Code content */}
            <div className="flex-1 overflow-auto rounded-b-xl bg-[#1e1e2e] p-4">
              <pre className="text-[13px] leading-relaxed text-[#cdd6f4] font-mono whitespace-pre-wrap break-words">
                <code>{files[activeFile]?.content || ''}</code>
              </pre>
            </div>
          </div>
        ) : (
          /* Preview iframe */
          <div className="flex-1 flex items-start justify-center p-3 overflow-hidden">
            <div
              className="h-full bg-white rounded-xl shadow-medium overflow-hidden transition-all duration-300 ease-out"
              style={{ width: DEVICE_WIDTHS[device], maxWidth: '100%' }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={safeCode}
                title={artifact.title || 'Website Preview'}
                sandbox="allow-scripts allow-same-origin"
                className="w-full h-full border-0"
                style={{ minHeight: '100%' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
